import {
    parseComponentsFromHtml, 
    fetchWithRetry, 
    validateRuntime,
    createResponse,
    handleError,
    fetchAndCacheComponentData,
    fetchAndCacheBlocks,
    resourceCache,
    PackageManager,
    BASE_URL
} from "./helpers.js";

export const listComponents = async () => {
    try {
        const response = await fetchWithRetry(`${BASE_URL}/components`);
        const html = await response.text();
        const components = parseComponentsFromHtml(html);
        return createResponse(JSON.stringify(components, null, 2));
    } catch (error) {
        return handleError(error, "Error fetching components list");
    }
}

export const getComponentDocs = async ({component}: {component: string}) => {
    try {
        if (!component) {
            return createResponse("Component name is required", true);
        }
        
        const componentData = await fetchAndCacheComponentData(component);
        
        if (!componentData.description && !componentData.doc) {
            return createResponse(`No documentation found for component '${component}'`, true);
        }
        
        return createResponse(
            `${componentData.doc}`,
            false,
            "text/markdown"
        );
    } catch (error) {
        return handleError(error, "Error fetching component documentation");
    }
}

export const installComponent = async ({component, runtime}: {component: string, runtime?: string}) => {
    try {
        if (!component) {
            return createResponse("Component name is required", true);
        }
        
        if (runtime && !validateRuntime(runtime)) {
            return createResponse(`Invalid runtime: ${runtime}. Must be one of: npm, pnpm, yarn, bun`, true);
        }
        
        const componentData = await fetchAndCacheComponentData(component);
        
        if (!componentData.commands?.[0]) {
            return createResponse(`No installation command found for component '${component}'`, true);
        }

        const commands = componentData.commands[0];
        const selectedRuntime = runtime as PackageManager | undefined;
        const command = selectedRuntime ? commands[selectedRuntime] : commands.npm;

        if (!command) {
            return createResponse(`No installation command found for runtime '${runtime}'`, true);
        }

        return createResponse(command);
    } catch (error) {
        return handleError(error, "Error generating installation command");
    }
}

export const listBlocks = async () => {
    try {
        const blocks = await fetchAndCacheBlocks();
        const blockNames = blocks.map(block => block.name);
        return createResponse(JSON.stringify(blockNames, null, 2));
    } catch (error) {
        return handleError(error, "Error fetching blocks");
    }
}

async function getBlockData(block: string) {
    if (!block) {
        return { error: "Block name is required" };
    }
    let blockData = resourceCache.get(block);
    if (!blockData) {
        await fetchAndCacheBlocks();
        blockData = resourceCache.get(block);
    }
    if (!blockData) {
        return { error: `Block '${block}' not found. Use list-blocks to see available blocks.` };
    }
    return { blockData };
}

export const getBlockDocs = async ({block}: {block: string}) => {
    try {
        const { blockData, error } = await getBlockData(block);
        if (error) return createResponse(error, true);
        if (!blockData) return createResponse("Unexpected error: block data missing", true);

        if (!blockData.doc) {
            return createResponse(`No documentation found for block '${block}'`, true);
        }

        return createResponse(
            `${JSON.stringify(blockData, null, 2)}`,
            false,
            "application/json"
        );
    } catch (error) {
        return handleError(error, "Error fetching block documentation");
    }
}

export const installBlock = async ({block, runtime}: {block: string, runtime?: string}) => {
    try {
        if (runtime && !validateRuntime(runtime)) {
            return createResponse(`Invalid runtime: ${runtime}. Must be one of: npm, pnpm, yarn, bun`, true);
        }
        const { blockData, error } = await getBlockData(block);
        if (error) return createResponse(error, true);
        if (!blockData) return createResponse("Unexpected error: block data missing", true);

        if (!blockData.commands?.[0]) {
            return createResponse(`No installation command found for block '${block}'`, true);
        }
        const commands = blockData.commands[0];
        const selectedRuntime = runtime as PackageManager | undefined;
        const command = selectedRuntime ? commands[selectedRuntime] : commands.npm;
        if (!command) {
            return createResponse(`No installation command found for runtime '${runtime}'`, true);
        }
        return createResponse(command);
    } catch (error) {
        return handleError(error, "Error generating installation command");
    }
}

