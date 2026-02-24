# Airframe MCP Client

Connect AI agents to Airframe's product intelligence and expert network using the Model Context Protocol (MCP).

## Features

- **Product Search**: Find software products by keyword, category, or department
- **Product Details**: Deep dive into specific products with comprehensive data
- **Product Comparison**: Side-by-side comparison of 2-5 products
- **Category Browser**: Explore Airframe's software category taxonomy
- **Expert Network**: Discover practitioners with specific product expertise
- **AI Intelligence**: Ask complex questions powered by Airframe's market research

## Prerequisites

- Node.js 18+ (includes native fetch support)
- MCP-compatible AI agent (Claude Desktop, Claude Code, etc.)
- Airframe API key (get one at [airframe.ai/account/api-keys](https://airframe.ai/account/api-keys))

## Installation

### Option 1: Using npx (Recommended)

No installation needed! Configure your MCP client to use npx.

For example, in your MCP configuration:

```json
{
  "mcpServers": {
    "airframe": {
      "command": "npx",
      "args": [
        "-y",
        "@airframe/mcp-client",
        "--api-key",
        "YOUR_API_KEY_HERE"
      ]
    }
  }
}
```

### Option 2: Global Installation

```bash
npm install -g @airframe/mcp-client
```

Then configure Claude Desktop:

```json
{
  "mcpServers": {
    "airframe": {
      "command": "airframe-mcp",
      "args": ["--api-key", "YOUR_API_KEY_HERE"]
    }
  }
}
```

### Option 3: Standalone Script

Download the bundled script from the releases page and run directly with Node:

```json
{
  "mcpServers": {
    "airframe": {
      "command": "node",
      "args": [
        "/path/to/airframe-mcp-client.js",
        "--api-key",
        "YOUR_API_KEY_HERE"
      ]
    }
  }
}
```

## Configuration Options

- `--api-key`: Your Airframe API key (required, starts with `af_`)
- `--server-url`: MCP server URL (optional, defaults to `https://mcp.airframe.ai/mcp`)

## Usage

After configuring Claude Desktop, restart the application. You can then use Airframe tools in your conversations:

```
> Search for CRM products and show me the top 3

> Compare Salesforce vs HubSpot

> Find experts who use Figma

> What are the best project management tools for remote teams?
```

## Available Tools

- `search_products` - Find software products by keyword, category, or department
- `get_product_details` - Deep dive on a specific product (use its slug)
- `compare_products` - Side-by-side comparison of 2-5 products
- `browse_categories` - Explore Airframe's software category taxonomy
- `find_experts` - Discover practitioners with specific product expertise
- `ask_airframe` - AI-powered market intelligence for complex questions

## Troubleshooting

### Check Node Version

```bash
node --version  # Should be 18 or higher
```

### View Claude Desktop Logs

**macOS**: `~/Library/Logs/Claude/mcp-server-airframe.log`

**Windows**: `%LOCALAPPDATA%\Claude\Logs\mcp-server-airframe.log`

### Test the Client Manually

```bash
# Using npx
npx -y @airframeai/mcp-client --api-key YOUR_API_KEY --help

# Or after global install
airframe-mcp --api-key YOUR_API_KEY --help
```

### Common Issues

**"Command not found"**: Make sure Node.js 18+ is installed and in your PATH

**"Invalid API key"**: Verify your API key starts with `af_` and is active at [airframe.ai/account/api-keys](https://airframe.ai/account/api-keys)

**Windows npx issues**: On Windows, you may need to use `cmd` wrapper:
```json
{
  "command": "cmd",
  "args": ["/c", "npx", "-y", "@airframe/mcp-client", "--api-key", "YOUR_API_KEY"]
}
```

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Create standalone bundle
npm run bundle
```

## Support

- Email: support@airframe.ai

## License

MIT
