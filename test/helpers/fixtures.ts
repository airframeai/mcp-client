/** Test data constants */

export const VALID_API_KEY = "af_test_key_123";
export const INVALID_API_KEY = "bad_key_no_prefix";
export const DEFAULT_SERVER_URL = "https://mcp.airframe.ai/mcp";
export const CUSTOM_SERVER_URL = "https://custom.example.com/mcp";

export const TOOLS_LIST_RESPONSE = {
  jsonrpc: "2.0" as const,
  id: 1,
  result: {
    tools: [
      {
        name: "search_products",
        description: "Search for software products",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
          },
          required: ["query"],
        },
      },
      {
        name: "get_product_details",
        description: "Get product details by slug",
        inputSchema: {
          type: "object",
          properties: {
            slug: { type: "string", description: "Product slug" },
          },
          required: ["slug"],
        },
      },
    ],
  },
};

export const TOOL_CALL_RESPONSE = {
  jsonrpc: "2.0" as const,
  id: 2,
  result: {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          products: [{ name: "Slack", slug: "slack", category: "Communication" }],
        }),
      },
    ],
  },
};

export const TOOL_CALL_ERROR_RESPONSE = {
  jsonrpc: "2.0" as const,
  id: 2,
  error: {
    code: -32603,
    message: "Internal server error",
  },
};

/** Blocked URLs for SSRF testing */
export const BLOCKED_URLS = [
  "http://localhost/mcp",
  "http://127.0.0.1/mcp",
  "http://0.0.0.0/mcp",
  "http://[::1]/mcp",
  "http://169.254.169.254/latest/meta-data",
  "http://foo.internal/mcp",
  "http://10.0.0.1/mcp",
  "http://192.168.1.1/mcp",
  "http://172.16.0.1/mcp",
  "http://172.31.255.255/mcp",
  "ftp://example.com/mcp",
  "file:///etc/passwd",
];

/** Valid URLs that should be accepted */
export const VALID_URLS = [
  "https://mcp.airframe.ai/mcp",
  "https://api.example.com/mcp",
  "http://api.example.com/mcp",
  "https://172.15.0.1/mcp", // 172.15.x.x is NOT private
  "https://11.0.0.1/mcp",   // 11.x.x.x is NOT private
];
