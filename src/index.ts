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

export const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Validate a server URL for safety. Returns an error string if invalid, or null if valid.
 */
export function validateServerUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "--server-url is not a valid URL";
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return "--server-url must use http or https";
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "[::1]" ||
    host === "169.254.169.254" ||
    host.endsWith(".internal") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return "--server-url must not point to internal/private addresses";
  }

  return null;
}

/**
 * Parse CLI arguments into { apiKey, serverUrl }. Throws on invalid input.
 * Returns null if --help was requested.
 */
export function parseCliArgs(args: string[]): { apiKey: string; serverUrl: string } | null {
  let apiKey = "";
  let serverUrl = "https://mcp.airframe.ai/mcp";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--api-key" && i + 1 < args.length) {
      apiKey = args[i + 1];
      i++;
    } else if (args[i] === "--server-url" && i + 1 < args.length) {
      const raw = args[i + 1];
      const error = validateServerUrl(raw);
      if (error) {
        throw new Error(`Error: ${error}`);
      }
      serverUrl = raw;
      i++;
    } else if (args[i] === "--help" || args[i] === "-h") {
      return null;
    }
  }

  if (!apiKey) {
    throw new Error("Error: --api-key is required");
  }

  if (!apiKey.startsWith("af_")) {
    console.error("Warning: API key should start with 'af_'");
  }

  return { apiKey, serverUrl };
}

export class AirframeMCPBridge {
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
      // Auto-generate progressToken if not provided to enable progress updates
      const progressToken =
        request.params._meta?.progressToken || crypto.randomUUID();

      const params: any = {
        name: request.params.name,
        arguments: request.params.arguments,
        _meta: { progressToken },
      };

      const response = await this.forwardRequest({
        jsonrpc: "2.0",
        id: ++this.requestIdCounter,
        method: "tools/call",
        params,
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

      // Pass through the entire result from the HTTP server
      return response.result as any;
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
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      }

      const contentType = response.headers.get("content-type") || "";

      // Handle SSE streaming response
      if (contentType.includes("text/event-stream")) {
        return await this.handleSSEStream(response, request);
      }

      // Handle regular JSON response
      const text = await response.text();
      if (text.length > MAX_RESPONSE_SIZE) {
        throw new Error("Response exceeded maximum allowed size");
      }
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

  private async handleSSEStream(
    response: Response,
    request: JsonRpcRequest
  ): Promise<JsonRpcResponse> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let finalResult: JsonRpcResponse | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");

        // Keep the last incomplete line in buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (!data) continue;

            try {
              const message = JSON.parse(data);

              // Handle progress notifications
              if (message.method === "notifications/progress") {
                console.error(
                  `[Airframe MCP] SSE Progress received: token=${message.params?.progressToken}, progress=${message.params?.progress}, total=${message.params?.total}`
                );

                // Forward progress notification to MCP client
                try {
                  await this.server.notification({
                    method: "notifications/progress",
                    params: message.params,
                  });
                  console.error(`[Airframe MCP] Progress notification forwarded successfully`);
                } catch (error) {
                  console.error(`[Airframe MCP] ERROR forwarding progress:`, error);
                }
              }
              // Handle final result
              else if (message.jsonrpc === "2.0" && message.id === request.id) {
                finalResult = message;
              }
            } catch (parseError) {
              console.error(`[Airframe MCP] Failed to parse SSE data (${data.length} bytes)`);
            }
          }
        }
      }

      if (!finalResult) {
        throw new Error("No final result received from SSE stream");
      }

      return finalResult;
    } finally {
      reader.releaseLock();
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

  // Check for help flag first
  if (args.includes("--help") || args.includes("-h")) {
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

  let parsed: { apiKey: string; serverUrl: string };
  try {
    const result = parseCliArgs(args);
    if (result === null) {
      process.exit(0);
    }
    parsed = result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(msg);
    if (msg.includes("--api-key is required")) {
      console.error("Usage: airframe-mcp --api-key YOUR_API_KEY [--server-url URL]");
      console.error("\nGet your API key at: https://airframe.ai/account/api-keys");
    }
    process.exit(1);
  }

  const bridge = new AirframeMCPBridge(parsed.apiKey, parsed.serverUrl);
  await bridge.run();
}

// Run if this is the main module (not when imported by tests)
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1] ? realpathSync(process.argv[1]) : "";

if (thisFile === entryFile) {
  main().catch((error) => {
    console.error("[Airframe MCP] Fatal error:", error);
    process.exit(1);
  });
}
