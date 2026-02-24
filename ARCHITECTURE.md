# Airframe MCP Node.js Client Architecture

## Overview

This is a self-contained Node.js/TypeScript implementation of the Airframe MCP client that bridges Claude Desktop's stdio transport to Airframe's HTTP MCP server.

## How It Works

```
┌──────────────────────────────────────────────────────────────┐
│                        Claude Desktop                        │
│  (MCP Client - sends JSON-RPC requests via stdio)           │
└───────────────────────────┬──────────────────────────────────┘
                            │
                  stdio (stdin/stdout)
                  JSON-RPC 2.0 protocol
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│              @airframe/mcp-client (this package)             │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  StdioServerTransport (@modelcontextprotocol/sdk)      │ │
│  │  - Reads JSON-RPC from stdin                           │ │
│  │  - Writes JSON-RPC to stdout                           │ │
│  └──────────────────┬─────────────────────────────────────┘ │
│                     │                                        │
│                     ▼                                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  AirframeMCPBridge                                     │ │
│  │  - Receives tools/list and tools/call requests        │ │
│  │  - Forwards to HTTP MCP server with API key           │ │
│  │  - Translates responses back to MCP protocol          │ │
│  └──────────────────┬─────────────────────────────────────┘ │
│                     │                                        │
└─────────────────────┼────────────────────────────────────────┘
                      │
                HTTPS POST
                X-API-Key header
                      │
                      ▼
┌──────────────────────────────────────────────────────────────┐
│        Airframe HTTP MCP Server (mcp.airframe.ai)           │
│  - Authentication & rate limiting                            │
│  - MongoDB, GraphQL, Typesense access                       │
│  - Returns product data, expert info, etc.                  │
└──────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. StdioServerTransport
- Provided by `@modelcontextprotocol/sdk`
- Handles the stdio transport layer
- Reads JSON-RPC requests from stdin
- Writes JSON-RPC responses to stdout
- Automatically handles protocol details

### 2. AirframeMCPBridge
- Our custom bridge implementation
- Implements two MCP request handlers:
  - `tools/list` - Returns available tools
  - `tools/call` - Executes a tool and returns results
- Forwards all requests to HTTP server via fetch
- Handles both regular JSON and SSE responses
- Adds API key authentication

### 3. HTTP Client (Native Fetch)
- Uses Node.js 18+ native fetch (no external deps!)
- Sets appropriate headers (Content-Type, API Key)
- 2-minute timeout for AI agent calls
- Parses both JSON and SSE response formats

## Response Format Handling

The HTTP MCP server can return responses in two formats:

### Regular JSON
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      { "type": "text", "text": "..." }
    ]
  }
}
```

### Server-Sent Events (SSE)
```
event: message
data: {"jsonrpc":"2.0","id":1,"result":{...}}
```

The bridge handles both automatically by checking for `event: message` in the response text.

## Dependencies

### Production
- `@modelcontextprotocol/sdk` (^1.0.4) - Official MCP SDK
  - Provides Server, Transport, and protocol types
  - Handles JSON-RPC serialization/deserialization
  - Manages stdio communication

### Development
- `typescript` (^5.7.3) - TypeScript compiler
- `esbuild` (^0.24.2) - Fast bundler for standalone build
- `@types/node` (^22.10.5) - Node.js type definitions

## Build Process

### Regular Build (npm package)
```bash
npm run build
```
1. Compiles TypeScript → JavaScript (ES modules)
2. Adds shebang to make executable
3. Outputs to `dist/index.js` with source maps

### Standalone Bundle
```bash
npm run bundle
```
1. Uses esbuild to bundle all dependencies
2. Inlines `@modelcontextprotocol/sdk` code
3. Creates single 696KB file
4. Adds shebang for direct execution
5. Outputs to `dist/airframe-mcp-client.js`

The standalone bundle is completely self-contained and can be distributed as a single file.

## Installation Methods

### 1. npx (Recommended)
```json
"command": "npx",
"args": ["-y", "@airframe/mcp-client", "--api-key", "..."]
```
- No installation required
- Always uses latest version
- Downloads on first use, then caches

### 2. Global Install
```bash
npm install -g @airframe/mcp-client
```
- Installs as system command
- Uses `airframe-mcp` binary
- Version pinned until updated

### 3. Standalone Script
```json
"command": "node",
"args": ["/path/to/airframe-mcp-client.js", "--api-key", "..."]
```
- Single file, no npm required
- Can be downloaded directly
- Perfect for air-gapped or restricted environments

## Error Handling

### Network Errors
- HTTP errors (4xx, 5xx) are caught and converted to JSON-RPC errors
- Connection failures return error code -32603
- Timeouts (120s) abort the request

### Protocol Errors
- Invalid JSON responses are caught
- Missing fields are handled gracefully
- Error messages logged to stderr (visible in Claude Desktop logs)

### Logging
All logs go to stderr with `[Airframe MCP]` prefix, making them visible in:
- Mac: `~/Library/Logs/Claude/mcp-server-airframe.log`
- Windows: `%LOCALAPPDATA%\Claude\Logs\mcp-server-airframe.log`

## Why Node.js Over Python?

### Advantages
1. **Simpler distribution** - npx eliminates manual downloads
2. **Native fetch** - No external HTTP library needed (Node 18+)
3. **Faster startup** - Node.js starts faster than Python
4. **Better ecosystem** - npm/npx is familiar to web developers
5. **Cross-platform** - Works identically on Mac, Windows, Linux

### Comparison to Python Version

| Feature | Node.js | Python |
|---------|---------|--------|
| Dependencies | 1 (MCP SDK) | 2 (mcp, httpx) |
| Installation | npx (zero-install) | pip install |
| Startup time | ~50ms | ~200ms |
| Bundle size | 696KB (self-contained) | N/A |
| HTTP client | Native fetch | httpx |

## Security

- API keys passed via CLI args (not env vars for Claude Desktop)
- HTTPS only for production server
- No sensitive data logged
- Timeouts prevent hanging connections
- API key validation on server side

## Performance

- Lazy loading of MCP SDK (only when needed)
- Persistent connection reuse via native fetch
- Minimal memory footprint (~30MB)
- Fast tool listing (cached on server)

## Future Enhancements

Potential improvements:
- [ ] Streaming responses for large datasets
- [ ] Response caching for repeated queries
- [ ] Connection pooling for concurrent requests
- [ ] Telemetry for usage analytics
- [ ] WebSocket transport option
