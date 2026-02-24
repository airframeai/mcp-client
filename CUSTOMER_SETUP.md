# Airframe MCP for Claude Desktop (Node.js)

Connect Claude Desktop to Airframe's product intelligence and expert network.

## Prerequisites

- Node.js 18+ (includes native fetch support)
- Claude Desktop installed

## Installation

### 1. Check Node.js Version

```bash
node --version  # Should be 18.0.0 or higher
```

If you don't have Node.js 18+, download it from [nodejs.org](https://nodejs.org/)

### 2. Get Your API Key

1. Visit [airframe.ai/account/api-keys](https://airframe.ai/account/api-keys)
2. Sign in or create an account
3. Click "Create API Key"
4. **Copy the key immediately** (shown only once!)

### 3. Choose Installation Method

#### Option A: Using npx (Recommended - No Installation)

Open your Claude Desktop config file:
- **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add this to the `mcpServers` section:

```json
{
  "mcpServers": {
    "airframe": {
      "command": "npx",
      "args": [
        "-y",
        "@airframeai/mcp-client",
        "--api-key",
        "YOUR_API_KEY_HERE"
      ]
    }
  }
}
```

**Windows users**: If you get connection errors, use this instead:

```json
{
  "mcpServers": {
    "airframe": {
      "command": "cmd",
      "args": [
        "/c",
        "npx",
        "-y",
        "@airframeai/mcp-client",
        "--api-key",
        "YOUR_API_KEY_HERE"
      ]
    }
  }
}
```

#### Option B: Standalone Script (No npm Required)

1. Download the standalone script: [airframe-mcp-client.js](https://github.com/airframehq/airframe/releases/latest/download/airframe-mcp-client.js)
2. Save it to a permanent location (e.g., `~/airframe-mcp-client.js`)
3. Configure Claude Desktop:

```json
{
  "mcpServers": {
    "airframe": {
      "command": "node",
      "args": [
        "/full/path/to/airframe-mcp-client.js",
        "--api-key",
        "YOUR_API_KEY_HERE"
      ]
    }
  }
}
```

**Replace `/full/path/to/` with the actual path!**

**Mac example**: `/Users/yourname/airframe-mcp-client.js`
**Windows example**: `C:\\Users\\yourname\\airframe-mcp-client.js`

#### Option C: Global Installation

```bash
npm install -g @airframeai/mcp-client
```

Then configure Claude Desktop:

```json
{
  "mcpServers": {
    "airframe": {
      "command": "airframe-mcp",
      "args": [
        "--api-key",
        "YOUR_API_KEY_HERE"
      ]
    }
  }
}
```

### 4. Restart Claude Desktop

Quit and relaunch Claude Desktop to load the configuration.

## Usage

In Claude Desktop, you'll now have access to Airframe tools:

- **search_products** - Find software products by keyword, category, or department
- **get_product_details** - Deep dive on a specific product
- **compare_products** - Side-by-side comparison of products
- **browse_categories** - Explore software category taxonomy
- **find_experts** - Discover practitioners with product expertise
- **ask_airframe** - AI-powered market intelligence

Try asking:
> "Search for CRM products and show me the top 3"
> "Find experts who use Salesforce"
> "Compare Slack vs Microsoft Teams"

## Troubleshooting

### "Command not found" or script won't run

Make sure Node.js 18+ is installed:
```bash
node --version
```

### "Invalid API key" error

- Verify your API key starts with `af_`
- Check it's active at [airframe.ai/account/api-keys](https://airframe.ai/account/api-keys)
- Make sure there are no extra spaces or quotes in the config

### Windows "Connection closed" errors

Use the `cmd /c` wrapper shown in Option A above.

### Check Logs

Claude Desktop logs are at:
- **Mac**: `~/Library/Logs/Claude/mcp-server-airframe.log`
- **Windows**: `%LOCALAPPDATA%\Claude\Logs\mcp-server-airframe.log`

Look for lines starting with `[Airframe MCP]`

### Test Manually

```bash
# Test the standalone script
node /path/to/airframe-mcp-client.js --help

# Or test with npx
npx -y @airframeai/mcp-client --help
```

## Advanced Configuration

### Custom Server URL

To use a different server (e.g., for testing):

```json
{
  "mcpServers": {
    "airframe": {
      "command": "npx",
      "args": [
        "-y",
        "@airframeai/mcp-client",
        "--api-key",
        "YOUR_API_KEY_HERE",
        "--server-url",
        "http://localhost:8001/mcp"
      ]
    }
  }
}
```

## Support

Questions? Email support@airframe.ai
