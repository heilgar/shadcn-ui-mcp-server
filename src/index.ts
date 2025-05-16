#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { listComponents, listBlocks, getComponentDocs, installComponent, installBlock, getBlockDocs } from "./handlers.js";


const toolDefinitions = {
    "list-components": {
        description: "Get the list of available shadcn/ui components",
        parameters: {},
        toolSchema: {},
        handler: listComponents
    },
    "get-component-docs": {
        description: "Get documentation for a specific shadcn/ui component",
        parameters: {
            component: { type: "string", description: "Name of the component to get documentation for" }
        },
        toolSchema: {
            component: z.string().describe("Name of the component to get documentation for")
        },
        handler: getComponentDocs
    },
    "install-component": {
        description: "Install a shadcn/ui component",
        parameters: {
            component: { type: "string", description: "Name of the component to install" },
            runtime: { type: "string", description: "User runtime (npm, pnpm, yarn, bun)", optional: true }
        },
        toolSchema: {
            component: z.string().describe("Name of the component to install"),
            runtime: z.string().describe("User runtime (npm, pnpm, yarn, bun)").optional()
        },
        handler: installComponent   
    },
    "list-blocks": {
        description: "Get the list of available shadcn/ui blocks",
        parameters: {},
        toolSchema: {},
        handler: listBlocks
    },
    "get-block-docs": {
        description: "Get documentation (code) for a specific shadcn/ui block",
        parameters: {
            block: { type: "string", description: "Name of the block to get documentation for" }
        },
        toolSchema: {
            block: z.string().describe("Name of the block to get documentation for")
        },
        handler: getBlockDocs
    },
    "install-blocks": {
        description: "Install a shadcn/ui block",
        parameters: {
            block: { type: "string", description: "Name of the block to install" },
            runtime: { type: "string", description: "User runtime (npm, pnpm, yarn, bun)", optional: true }
        },
        toolSchema: {
            block: z.string().describe("Name of the block to install"),
            runtime: z.string().describe("User runtime (npm, pnpm, yarn, bun)").optional()
        },
        handler: installBlock
    },
};

const server = new McpServer({
    name: "shadcn-ui-mcp-server",
    version: "1.0.0",
    capabilities: {
       tools: toolDefinitions
    },
});

for (const [name, definition] of Object.entries(toolDefinitions)) {
    server.tool(
        name,
        definition.toolSchema,
        definition.handler
    );
}

async function main() {
    try {
        const transport = new StdioServerTransport();
        console.error("Starting shadcn/ui MCP server...");
        await server.connect(transport);
        console.error("Server connected and ready");
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

main().catch(error => {
    console.error("Unhandled error:", error);
    process.exit(1);
});