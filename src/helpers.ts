import { load } from "cheerio";

export const RETRY_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 500;
export const BASE_URL = "https://ui.shadcn.com";
export const RAW_GITHUB_URL = "https://raw.githubusercontent.com/shadcn-ui/ui/refs/heads/main/apps";

export const BLOCK_PAGES = [
    `${BASE_URL}/blocks/sidebar`,
    `${BASE_URL}/blocks/authentication`,
];

export type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

export interface CommandSet {
    npm: string;
    pnpm: string;
    yarn: string;
    bun: string;
}

export interface ComponentDocResource {
    name: string;
    description?: string;
    doc?: string;
    commands?: CommandSet[];
    links?: string[];
    isBlock?: boolean;
}

export const RUNTIME_REPLACEMENTS: Record<Exclude<PackageManager, 'npm'>, string> = {
    pnpm: 'pnpm dlx',
    yarn: 'yarn dlx',
    bun: 'bunx'
};

export const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;
export const DESCRIPTION_PATTERNS = [
    /description:\s*["']([^"']+)["']/,
    /description:\s*([^\n]+)/,
    /description\s*:\s*["']([^"']+)["']/
];
export const FIRST_PARAGRAPH_REGEX = /---\n[\s\S]*?\n---\n\n([^\n]+)/;
export const LINKS_REGEX = /links:\n([\s\S]*?)(?=\n\w|$)/;
export const CLI_COMMAND_REGEX = /```bash\nnpx shadcn@latest add [^\n]+\n```/;
export const USAGE_REGEX = /## Usage\n\n([\s\S]*?)(?=\n## |$)/;
export const CODE_BLOCKS_REGEX = /```(?:tsx|ts|jsx|js)([\s\S]*?)```/g;
export const CODE_BLOCK_CLEANUP_REGEX = /```(?:tsx|ts|jsx|js)\n|```$/g;

export const resourceCache = new Map<string, ComponentDocResource>();

const loadCheerio = (html: string) => load(html, {
    decodeEntities: true
});

export const validateRuntime = (runtime?: string): runtime is PackageManager => 
    !runtime || ['npm', 'pnpm', 'yarn', 'bun'].includes(runtime);

export const extractDescription = (frontmatter: string, mdxContent: string): string => {
    for (const pattern of DESCRIPTION_PATTERNS) {
        const match = frontmatter.match(pattern);
        if (match) return match[1].trim();
    }
    
    const firstParagraphMatch = mdxContent.match(FIRST_PARAGRAPH_REGEX);
    return firstParagraphMatch ? firstParagraphMatch[1].trim() : '';
};

export const extractLinks = (frontmatter: string): string[] => {
    const links: string[] = [];
    const linksMatch = frontmatter.match(LINKS_REGEX);
    
    if (linksMatch) {
        const linksContent = linksMatch[1];
        const docLinkMatch = linksContent.match(/doc:\s*([^\n]+)/);
        const apiLinkMatch = linksContent.match(/api:\s*([^\n]+)/);
        
        if (docLinkMatch) links.push(docLinkMatch[1].trim());
        if (apiLinkMatch) links.push(apiLinkMatch[1].trim());
    }
    
    return links;
};

export const getCliCommand = (cliCommand: string, runtime?: PackageManager): string => {
    if (!runtime || runtime === 'npm') return cliCommand;
    return cliCommand.replace('npx', RUNTIME_REPLACEMENTS[runtime]);
};

export const createResponse = (text: string, isError = false, mimeType?: string) => ({
    content: [{ type: "text" as const, text, ...(mimeType && { mimeType }) }],
    ...(isError && { isError })
});

export const handleError = (error: unknown, prefix: string) => 
    createResponse(`${prefix}: ${error instanceof Error ? error.message : String(error)}`, true);

export async function fetchWithRetry(url: string, retries = RETRY_ATTEMPTS, delay = RETRY_DELAY_MS): Promise<Response> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        return response;
    } catch (error) {
        if (retries <= 1) throw error;
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(url, retries - 1, delay * 2); // Exponential backoff
    }
}

async function cacheResource<T>(
    key: string,
    fetchFn: () => Promise<T>,
    cache: Map<string, T>
): Promise<T> {
    // Check cache first
    if (cache.has(key)) {
        return cache.get(key)!;
    }

    try {
        const data = await fetchFn();
        cache.set(key, data);
        return data;
    } catch (error) {
        throw new Error(`Failed to fetch data for key '${key}': ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function fetchAndCache(
    key: string,
    fetchFn: () => Promise<any>,
    transformFn: (data: any) => ComponentDocResource[]
): Promise<ComponentDocResource[]> {
    try {
        const rawData = await fetchFn();
        const transformedData = transformFn(rawData);
        transformedData.forEach(data => resourceCache.set(data.name, data));
        return transformedData;
    } catch (error) {
        throw new Error(
            `Failed to fetch and transform data for key '${key}': ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }
}

export async function fetchAndCacheComponentData(component: string): Promise<ComponentDocResource> {
    if (!component || typeof component !== 'string') {
        throw new Error('Invalid component name');
    }
    
    // Sanitize component name
    const sanitizedComponent = component.replace(/[^a-zA-Z0-9-_]/g, '');
    if (sanitizedComponent !== component) {
        throw new Error(`Invalid component name: ${component}`);
    }
    
    // Check cache
    if (resourceCache.has(component)) {
        return resourceCache.get(component)!;
    }

    const docSubPath = `www/content/docs/components`;
    const url = `${RAW_GITHUB_URL}/${docSubPath}/${component}.mdx`;

    const transformComponentData = (mdxContent: string): ComponentDocResource[] => {
        const frontmatterMatch = mdxContent.match(FRONTMATTER_REGEX);
        const frontmatter = frontmatterMatch ? frontmatterMatch[1] : '';
        
        const description = extractDescription(frontmatter, mdxContent);
        const links = extractLinks(frontmatter);

        const cliCommandMatch = mdxContent.match(CLI_COMMAND_REGEX);
        const cliCommand = cliCommandMatch ? cliCommandMatch[0].replace(/```bash\n|\n```/g, '').trim() : undefined;

        let commands: CommandSet[] | undefined = undefined;
        
        if (cliCommand) {
            commands = [{
                npm: cliCommand,
                pnpm: getCliCommand(cliCommand, 'pnpm'),
                yarn: getCliCommand(cliCommand, 'yarn'),
                bun: getCliCommand(cliCommand, 'bun')
            }];
        }

        return [{
            name: component,
            description,
            doc: mdxContent,
            commands,
            links: links.length > 0 ? links : undefined,
            isBlock: false
        }];
    };

    const [componentData] = await fetchAndCache(
        component,
        async () => {
            const response = await fetchWithRetry(url);
            return response.text();
        },
        transformComponentData
    );

    return componentData;
}

export type Block = {
    name: string;
    command: string;
    doc: string;
    description?: string;
};

export async function fetchAndCacheBlocks(): Promise<ComponentDocResource[]> {
    const transformBlocks = (blockPages: Block[][]): ComponentDocResource[] => {
        const allBlocks = blockPages.flat();
        
        return allBlocks.map((block: Block) => ({
            name: block.name,
            description: block.description,
            doc: block.doc,
            commands: [{
                npm: block.command,
                pnpm: getCliCommand(block.command, 'pnpm'),
                yarn: getCliCommand(block.command, 'yarn'),
                bun: getCliCommand(block.command, 'bun')
            }],
            isBlock: true
        }));
    };

    return fetchAndCache(
        'blocks',
        async () => Promise.all(BLOCK_PAGES.map(parseBlocksFromPage)),
        transformBlocks
    );
}

export async function parseBlocksFromPage(url: string): Promise<Block[]> {
    if (!url || !url.startsWith('https://')) {
        throw new Error(`Invalid URL: ${url}`);
    }

    try {
        const response = await fetchWithRetry(url);
        const html = await response.text();
        const $ = loadCheerio(html);

        const blocks: Block[] = [];
        
        $('.container-wrapper.flex-1 div[id]').each((_, el) => {
            const $block = $(el);
            const id = $block.attr('id');

            if (id && !id.startsWith('radix-')) {
                const anchor = $block.find('div.flex.w-full.items-center.gap-2.md\\:pr-\\[14px\\] > a');
                const description = anchor.text().trim();
                const command = $block.find('div.flex.w-full.items-center.gap-2.md\\:pr-\\[14px\\] > div.ml-auto.hidden.items-center.gap-2.md\\:flex > div.flex.h-7.items-center.gap-1.rounded-md.border.p-\\[2px\\] > button > span').text().trim();
                const doc = $block.find('code').first().text().trim();
                
                blocks.push({ name: id, description, command, doc });
            }
        });

        if (blocks.length === 0) {
            console.error(`Warning: No blocks found at ${url}`);
        }

        return blocks;
    } catch (error) {
        throw new Error(`Failed to parse blocks from ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function parseComponentsFromHtml(html: string): string[] {
    if (!html || typeof html !== 'string') {
        throw new Error('Invalid HTML content');
    }
    
    try {
        const $ = loadCheerio(html);
        
        const components = $('a[href^="/docs/components/"]')
            .map((_, el) => {
                const href = $(el).attr('href');
                return href?.split('/').pop();
            })
            .get()
            .filter((name): name is string => Boolean(name))
            .sort();
        
        if (components.length === 0) {
            console.error('Warning: No components found in HTML');
        }
        
        return components;
    } catch (error) {
        throw new Error(`Failed to parse components: ${error instanceof Error ? error.message : String(error)}`);
    }
}