# Shadcn UI MCP Server

A powerful and flexible MCP (Model Control Protocol) server designed to enhance the development experience with Shadcn UI components. This server provides a robust foundation for building and managing UI components with advanced tooling and functionality.

## Features

### Tools 
The MCP server provides a set of tools that can be used through the Model Control Protocol:

- `list-components`: Get the list of available shadcn/ui components
- `get-component-docs`: Get documentation for a specific component
- `install-component`: Install a shadcn/ui component
- `list-blocks`: Get the list of available shadcn/ui blocks
- `get-block-docs`: Get documentation for a specific block
- `install-blocks`: Install a shadcn/ui block

### Functionality
- **Component Management**
  - List available shadcn/ui components
  - Get detailed documentation for specific components
  - Install components with support for multiple package managers (npm, pnpm, yarn, bun)

- **Block Management**
  - List available shadcn/ui blocks
  - Get documentation and code for specific blocks
  - Install blocks with support for multiple package managers

- **Package Manager Support**
  - Flexible runtime support for npm, pnpm, yarn, and bun
  - Automatic detection of user's preferred package manager

## Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn package manager

### Claude Desktop Configuration
To use with Claude Desktop, add the server config:

On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "shadcn-ui-server": {
      "command": "npx",
      "args": ["@heilgar/shadcn-ui-mcp-server"]
    }
  }
}
```

### Windsurf Configuration
Add this to your `./codeium/windsurf/model_config.json`:

```json
{
  "mcpServers": {
    "shadcn-ui-server": {
      "command": "npx",
      "args": ["@heilgar/shadcn-ui-mcp-server"]
    }
  }
}
```

### Cursor Configuration
Add this to your `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "shadcn-ui-server": {
      "command": "npx",
      "args": ["@heilgar/shadcn-ui-mcp-server"]
    }
  }
}
```

## Development and Debugging

### Local Development
1. Install dependencies:
```bash
npm install
```

2. Build the server:
```bash
npm run build
```

### Debugging
Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) for debugging:

```bash
npm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser, allowing you to:
- Monitor MCP communication
- Inspect tool calls and responses
- Debug server behavior
- View real-time logs

## Related Projects and Dependencies

This project is built using the following tools and libraries:

- [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - The official TypeScript SDK for MCP servers and clients
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector) - A debugging tool for MCP servers
- [Cheerio](https://github.com/cheeriojs/cheerio) - Fast, flexible, and lean implementation of core jQuery designed specifically for the server

## License

MIT License - feel free to use this project for your own purposes.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 
