import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AirframeMCPBridge } from "../src/index.js";
import { VALID_API_KEY, DEFAULT_SERVER_URL, TOOLS_LIST_RESPONSE, TOOL_CALL_RESPONSE } from "./helpers/fixtures.js";
import { mockJsonResponse } from "./helpers/mocks.js";

// Mock the MCP SDK so the constructor doesn't fail
vi.mock("@modelcontextprotocol/sdk/server/index.js", () => ({
  Server: class MockServer {
    _handlers = new Map<string, Function>();
    setRequestHandler(schema: any, handler: Function) {
      const key = schema?.method ?? JSON.stringify(schema);
      this._handlers.set(key, handler);
    }
    notification = vi.fn();
    connect = vi.fn();
  },
}));

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: vi.fn(),
}));

describe("AirframeMCPBridge", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockJsonResponse(TOOLS_LIST_RESPONSE)
    );
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("constructs without errors", () => {
    const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
    expect(bridge).toBeDefined();
  });

  describe("tools/list forwarding", () => {
    it("sends correct headers and body to upstream", async () => {
      fetchSpy.mockResolvedValueOnce(mockJsonResponse(TOOLS_LIST_RESPONSE));

      const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);

      // Access the internal server mock to get the handler
      const server = (bridge as any).server;
      const listHandler = Array.from(server._handlers.values())[0] as Function;

      const result = await listHandler({});

      expect(fetchSpy).toHaveBeenCalledWith(
        DEFAULT_SERVER_URL,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
            "X-API-Key": VALID_API_KEY,
          }),
        })
      );

      // Verify the JSON-RPC body
      const callArgs = fetchSpy.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.method).toBe("tools/list");
      expect(body.jsonrpc).toBe("2.0");
    });

    it("returns tools array from upstream response", async () => {
      fetchSpy.mockResolvedValueOnce(mockJsonResponse(TOOLS_LIST_RESPONSE));

      const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
      const server = (bridge as any).server;
      const listHandler = Array.from(server._handlers.values())[0] as Function;

      const result = await listHandler({});
      expect(result.tools).toHaveLength(2);
      expect(result.tools[0].name).toBe("search_products");
    });

    it("returns empty tools array when upstream returns no tools", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockJsonResponse({ jsonrpc: "2.0", id: 1, result: {} })
      );

      const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
      const server = (bridge as any).server;
      const listHandler = Array.from(server._handlers.values())[0] as Function;

      const result = await listHandler({});
      expect(result.tools).toEqual([]);
    });

    it("throws on upstream error response", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockJsonResponse({
          jsonrpc: "2.0",
          id: 1,
          error: { code: -32600, message: "Bad request" },
        })
      );

      const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
      const server = (bridge as any).server;
      const listHandler = Array.from(server._handlers.values())[0] as Function;

      await expect(listHandler({})).rejects.toThrow("Bad request");
    });
  });

  describe("tools/call forwarding", () => {
    it("forwards tool name and arguments", async () => {
      fetchSpy.mockResolvedValueOnce(mockJsonResponse(TOOL_CALL_RESPONSE));
      vi.spyOn(crypto, "randomUUID").mockReturnValue(
        "test-uuid-1234" as `${string}-${string}-${string}-${string}-${string}`
      );

      const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
      const server = (bridge as any).server;
      const callHandler = Array.from(server._handlers.values())[1] as Function;

      await callHandler({
        params: {
          name: "search_products",
          arguments: { query: "slack" },
        },
      });

      const callArgs = fetchSpy.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.method).toBe("tools/call");
      expect(body.params.name).toBe("search_products");
      expect(body.params.arguments).toEqual({ query: "slack" });
    });

    it("auto-generates progressToken when not provided", async () => {
      fetchSpy.mockResolvedValueOnce(mockJsonResponse(TOOL_CALL_RESPONSE));
      vi.spyOn(crypto, "randomUUID").mockReturnValue(
        "generated-token" as `${string}-${string}-${string}-${string}-${string}`
      );

      const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
      const server = (bridge as any).server;
      const callHandler = Array.from(server._handlers.values())[1] as Function;

      await callHandler({
        params: {
          name: "search_products",
          arguments: {},
        },
      });

      const callArgs = fetchSpy.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.params._meta.progressToken).toBe("generated-token");
    });

    it("preserves existing progressToken", async () => {
      fetchSpy.mockResolvedValueOnce(mockJsonResponse(TOOL_CALL_RESPONSE));

      const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
      const server = (bridge as any).server;
      const callHandler = Array.from(server._handlers.values())[1] as Function;

      await callHandler({
        params: {
          name: "search_products",
          arguments: {},
          _meta: { progressToken: "client-token-42" },
        },
      });

      const callArgs = fetchSpy.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.params._meta.progressToken).toBe("client-token-42");
    });

    it("returns error content on upstream error", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockJsonResponse({
          jsonrpc: "2.0",
          id: 2,
          error: { code: -32603, message: "Tool execution failed" },
        })
      );

      const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
      const server = (bridge as any).server;
      const callHandler = Array.from(server._handlers.values())[1] as Function;

      const result = await callHandler({
        params: { name: "search_products", arguments: {} },
      });

      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toContain("Tool execution failed");
    });
  });

  describe("request ID counter", () => {
    it("increments request IDs across calls", async () => {
      fetchSpy
        .mockResolvedValueOnce(mockJsonResponse(TOOLS_LIST_RESPONSE))
        .mockResolvedValueOnce(mockJsonResponse(TOOLS_LIST_RESPONSE));

      const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
      const server = (bridge as any).server;
      const listHandler = Array.from(server._handlers.values())[0] as Function;

      await listHandler({});
      await listHandler({});

      const body1 = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      const body2 = JSON.parse(fetchSpy.mock.calls[1][1]?.body as string);
      expect(body2.id).toBeGreaterThan(body1.id);
    });
  });
});
