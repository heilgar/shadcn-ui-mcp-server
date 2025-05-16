import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { parseBlocksFromPage, parseComponentsFromHtml } from "./parsers.js";


const BASE_URL = "https://ui.shadcn.com";
const RAW_GITHUB_URL = "https://raw.githubusercontent.com/shadcn-ui/ui/refs/heads/main/apps";

const BLOCK_PAGES = [
    "https://ui.shadcn.com/blocks/sidebar",
    "https://ui.shadcn.com/blocks/authentication",
    "https://ui.shadcn.com/blocks/login"
];

type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

interface ComponentDocResource {
    name: string;
    description?: string;
    code?: string;
    commands?: Record<PackageManager, string>[];
    links?: string[];
}

const cache = new Map<string, ComponentDocResource>();

const server = new McpServer({
    name: "shadcn-ui-mcp-server",
    version: "1.0.0",
    capabilities: {
        tools: {
            "list-components": {
                description: "Get the list of available shadcn/ui components",
                parameters: {}
            },
            "list-blocks": {
                description: "Get the list of available shadcn/ui blocks",
                parameters: {}
            },
            "get-component-docs": {
                description: "Get documentation for a specific shadcn/ui component",
                parameters: {
                    component: { type: "string", description: "Name of the component" }
                }
            },
            "install-component": {
                description: "Install a shadcn/ui component",
                parameters: {
                    component: { type: "string", description: "Name of the component to install" },
                    runtime: { type: "string", description: "User runtime (npm, pnpm, yarn, bun)", optional: true }
                }
            },
            "install-blocks": {
                description: "Install a shadcn/ui block",
                parameters: {
                    block: { type: "string", description: "Name of the block to install" },
                    runtime: { type: "string", description: "User runtime (npm, pnpm, yarn, bun)", optional: true }
                }
            }
        }
    },
});

// Helper function to fetch and cache component data
async function fetchAndCacheComponentData(component: string): Promise<ComponentDocResource> {
    if (cache.has(component)) {
        return cache.get(component)!;
    }

    const docSubPath = `www/content/docs/components/`

    try {
        // Fetch the MDX documentation
        const response = await fetch(`${RAW_GITHUB_URL}/${docSubPath}/${component}.mdx`);
        if (!response.ok) {
            throw new Error(`Failed to fetch MDX file: ${response.statusText}`);
        }
        
        const mdxContent = await response.text();
        
        // Extract frontmatter
        const frontmatterMatch = mdxContent.match(/^---\n([\s\S]*?)\n---/);
        const frontmatter = frontmatterMatch ? frontmatterMatch[1] : '';
        
        // Extract description from frontmatter - try different patterns
        let description = '';
        const descriptionPatterns = [
            /description:\s*["']([^"']+)["']/,  // description: "text"
            /description:\s*([^\n]+)/,          // description: text
            /description\s*:\s*["']([^"']+)["']/ // description : "text"
        ];

        for (const pattern of descriptionPatterns) {
            const match = frontmatter.match(pattern);
            if (match) {
                description = match[1].trim();
                break;
            }
        }

        // If no description found in frontmatter, try to get it from the first paragraph
        if (!description) {
            const firstParagraphMatch = mdxContent.match(/---\n[\s\S]*?\n---\n\n([^\n]+)/);
            if (firstParagraphMatch) {
                description = firstParagraphMatch[1].trim();
            }
        }

        // Extract links from frontmatter
        const links: string[] = [];
        const linksMatch = frontmatter.match(/links:\n([\s\S]*?)(?=\n\w|$)/);
        if (linksMatch) {
            const linksContent = linksMatch[1];
            const docLinkMatch = linksContent.match(/doc:\s*([^\n]+)/);
            const apiLinkMatch = linksContent.match(/api:\s*([^\n]+)/);
            
            if (docLinkMatch) links.push(docLinkMatch[1].trim());
            if (apiLinkMatch) links.push(apiLinkMatch[1].trim());
        }

        // Extract installation commands
        const cliCommandMatch = mdxContent.match(/```bash\nnpx shadcn@latest add [^\n]+\n```/);
        const cliCommand = cliCommandMatch ? cliCommandMatch[0].replace(/```bash\n|\n```/g, '').trim() : undefined;

        // Extract all content after Usage section
        const usageMatch = mdxContent.match(/## Usage\n\n([\s\S]*?)(?=\n## |$)/);
        let usageContent = usageMatch ? usageMatch[1].trim() : undefined;

        // Extract and merge all code blocks if content exists
        if (usageContent) {
            const codeBlocks = usageContent.match(/```(?:tsx|ts|jsx|js)([\s\S]*?)```/g) || [];
            if (codeBlocks.length > 0) {
                // Clean up and merge all code blocks
                usageContent = codeBlocks
                    .map(block => block
                        .replace(/```(?:tsx|ts|jsx|js)\n/, '')  // Remove opening marker
                        .replace(/```$/, '')                     // Remove closing marker
                        .trim()
                    )
                    .join('\n\n');                              // Join with double newlines
            }
        }

        const componentData: ComponentDocResource = {
            name: component,
            description,
            code: usageContent,
            commands: cliCommand ? [{
                npm: cliCommand,
                pnpm: cliCommand.replace('npx', 'pnpm dlx'),
                yarn: cliCommand.replace('npx', 'yarn dlx'),
                bun: cliCommand.replace('npx', 'bunx')
            }] : undefined,
            links: links.length > 0 ? links : undefined
        };

        cache.set(component, componentData);
        return componentData;
    } catch (error) {
        throw new Error(`Failed to fetch component data: ${error instanceof Error ? error.message : String(error)}`);
    }
}

server.tool(
    "list-components",
    {},
    async () => {
        try {
            const response = await fetch(`${BASE_URL}/components`);
            const html = await response.text();
            const components = parseComponentsFromHtml(html);
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(components, null, 2)
                }]
            };
        } catch (error) {
            return {
                content: [{
                    type: "text",
                    text: `Error fetching components list: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
    }
);

server.tool(
    "list-blocks",
    {},
    async () => {
        const [sidebar, authentication, login] = await Promise.all([
            parseBlocksFromPage(BLOCK_PAGES[0]),
            parseBlocksFromPage(BLOCK_PAGES[1]),
            parseBlocksFromPage(BLOCK_PAGES[2])
        ]);

        const allBlocks = [...sidebar, ...authentication, ...login];

        // Convert and cache
        allBlocks.forEach(block => {
            const resource: ComponentDocResource = {
                name: block.name,
                code: block.code,
                commands: [{
                    npm: block.command,
                    pnpm: block.command.replace('npx', 'pnpm dlx'),
                    yarn: block.command.replace('npx', 'yarn dlx'),
                    bun: block.command.replace('npx', 'bunx')
                }]
            };
            cache.set(block.name, resource);
        });

        return {
            content: [{ type: "text", text: JSON.stringify(allBlocks, null, 2) }]
        };
    }
);

server.tool(
    "get-component-docs",
    { component: z.string() },
    async ({ component }) => {
        try {
            const componentData = await fetchAndCacheComponentData(component);
            
            return {
                content: [
                    {
                        type: "text",
                        text: `## Documentation\n${componentData.description}\n\n## Code Example\n\`\`\`tsx\n${componentData.code || "Code example not found."}\n\`\`\``,
                        mimeType: "text/markdown",
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error fetching component documentation: ${error instanceof Error ? error.message : String(error)}`
                    }
                ],
                isError: true
            };
        }
    }
);

server.tool(
    "install-component",
    { 
        component: z.string(),
        runtime: z.string().optional()
    },
    async ({ component, runtime }) => {
        try {
            const componentData = await fetchAndCacheComponentData(component);
            
            if (!componentData.commands?.[0]) {
                return {
                    content: [{
                        type: "text",
                        text: `No installation command found for component ${component}`
                    }],
                    isError: true
                };
            }

            const commands = componentData.commands[0];
            const command = runtime ? commands[runtime as PackageManager] : commands.npm;

            if (!command) {
                return {
                    content: [{
                        type: "text",
                        text: `No installation command found for runtime ${runtime}`
                    }],
                    isError: true
                };
            }

            return {
                content: [{
                    type: "text",
                    text: command
                }]
            };
        } catch (error) {
            return {
                content: [{
                    type: "text",
                    text: `Error installing component: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
    }
);

server.tool(
    "install-blocks",
    {
        block: z.string(),
        runtime: z.string().optional()
    },
    async ({ block, runtime }) => {
        try {
            const resource = cache.get(block);
            if (!resource || !resource.commands?.[0]) {
                return {
                    content: [{
                        type: "text",
                        text: `No installation command found for block ${block}`
                    }],
                    isError: true
                };
            }
            const commands = resource.commands[0];
            const command = runtime ? commands[runtime as PackageManager] : commands.npm;
            if (!command) {
                return {
                    content: [{
                        type: "text",
                        text: `No installation command found for runtime ${runtime}`
                    }],
                    isError: true
                };
            }
            return {
                content: [{
                    type: "text",
                    text: command
                }]
            };
        } catch (error) {
            return {
                content: [{
                    type: "text",
                    text: `Error installing block: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
    }
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch(console.error);