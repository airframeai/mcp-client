/**
 * Airframe MCP Client for Claude Desktop
 *
 * Stdio-to-HTTP bridge that forwards MCP requests to Airframe's HTTP MCP server.
 * This allows Claude Desktop to use Airframe's product intelligence and expert network.
 *
 * Installation:
 *     npm install -g @airframeai/mcp-client
 *
 * Claude Desktop Configuration:
 *     {
 *       "mcpServers": {
 *         "airframe": {
 *           "command": "npx",
 *           "args": [
 *             "-y",
 *             "@airframeai/mcp-client",
 *             "--api-key",
 *             "YOUR_API_KEY_HERE"
 *           ]
 *         }
 *       }
 *     }
 *
 * Standalone Usage (without npm):
 *     node airframe-mcp-client.js --api-key YOUR_API_KEY_HERE
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

interface JsonRpcRequest {
  jsonrpc: string;
  id: number | string;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: string;
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface ToolResult {
  content: Array<{ type: string; text: string }>;
}

class AirframeMCPBridge {
  private apiKey: string;
  private serverUrl: string;
  private server: Server;
  private requestIdCounter = 0;

  constructor(apiKey: string, serverUrl: string) {
    this.apiKey = apiKey;
    this.serverUrl = serverUrl;
    this.server = new Server(
      {
        name: "airframe",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const response = await this.forwardRequest({
        jsonrpc: "2.0",
        id: ++this.requestIdCounter,
        method: "tools/list",
        params: {},
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.result as { tools: Tool[] } | undefined;
      return {
        tools: result?.tools || [],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const response = await this.forwardRequest({
        jsonrpc: "2.0",
        id: ++this.requestIdCounter,
        method: "tools/call",
        params: {
          name: request.params.name,
          arguments: request.params.arguments,
        },
      });

      if (response.error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${response.error.message}`,
            },
          ],
        };
      }

      const result = response.result as ToolResult | undefined;
      return {
        content: result?.content || [],
      };
    });
  }

  private async forwardRequest(
    request: JsonRpcRequest
  ): Promise<JsonRpcResponse> {
    try {
      const response = await fetch(this.serverUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "X-API-Key": this.apiKey,
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(120000), // 2 minute timeout for AI agent calls
      });

      if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const text = await response.text();

      // Handle SSE (Server-Sent Events) response format
      if (text.includes("event: message") && text.includes("\ndata: ")) {
        const parts = text.split("\ndata: ");
        if (parts.length > 1) {
          const jsonStr = parts[1].trim();
          return JSON.parse(jsonStr);
        }
      }

      // Fallback to regular JSON
      return JSON.parse(text);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Log to stderr (visible in Claude Desktop logs)
      console.error(`[Airframe MCP] Error: ${errorMessage}`);

      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: -32603,
          message: errorMessage,
        },
      };
    }
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    // Log startup (visible in Claude Desktop logs)
    console.error("[Airframe MCP] Bridge started successfully");
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Parse command line arguments
  let apiKey = "";
  let serverUrl = "https://mcp.airframe.ai/mcp";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--api-key" && i + 1 < args.length) {
      apiKey = args[i + 1];
      i++;
    } else if (args[i] === "--server-url" && i + 1 < args.length) {
      serverUrl = args[i + 1];
      i++;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
Airframe MCP Client for Claude Desktop

Usage: airframe-mcp --api-key YOUR_API_KEY [options]

Options:
  --api-key KEY       Your Airframe API key (required, starts with af_)
  --server-url URL    MCP server URL (default: https://mcp.airframe.ai/mcp)
  --help, -h          Show this help message

Get your API key at: https://airframe.ai/account/api-keys

Claude Desktop Configuration:
  Add to ~/Library/Application Support/Claude/claude_desktop_config.json:
  {
    "mcpServers": {
      "airframe": {
        "command": "npx",
        "args": ["-y", "@airframeai/mcp-client", "--api-key", "YOUR_API_KEY"]
      }
    }
  }
`);
      process.exit(0);
    }
  }

  if (!apiKey) {
    console.error("Error: --api-key is required\n");
    console.error("Usage: airframe-mcp --api-key YOUR_API_KEY [--server-url URL]");
    console.error("\nGet your API key at: https://airframe.ai/account/api-keys");
    process.exit(1);
  }

  if (!apiKey.startsWith("af_")) {
    console.error("Warning: API key should start with 'af_'");
  }

  const bridge = new AirframeMCPBridge(apiKey, serverUrl);
  await bridge.run();
}

// Run if this is the main module
main().catch((error) => {
  console.error("[Airframe MCP] Fatal error:", error);
  process.exit(1);
});
