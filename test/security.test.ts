import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AirframeMCPBridge, MAX_RESPONSE_SIZE, validateServerUrl } from "../src/index.js";
import { VALID_API_KEY, BLOCKED_URLS } from "./helpers/fixtures.js";
import { mockJsonResponse } from "./helpers/mocks.js";

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

describe("Security", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe("MAX_RESPONSE_SIZE constant", () => {
    it("is 10 MB", () => {
      expect(MAX_RESPONSE_SIZE).toBe(10 * 1024 * 1024);
    });
  });

  describe("SSRF prevention via validateServerUrl", () => {
    it.each(BLOCKED_URLS)("blocks %s", (url) => {
      const result = validateServerUrl(url);
      expect(result).not.toBeNull();
    });
  });

  describe("Error message sanitization", () => {
    it("does not leak full stack traces to clients", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("connect ECONNREFUSED 10.0.0.1:443"));

      const bridge = new AirframeMCPBridge(VALID_API_KEY, "https://example.com/mcp");
      const server = (bridge as any).server;
      const callHandler = Array.from(server._handlers.values())[1] as Function;

      const result = await callHandler({
        params: { name: "test", arguments: {} },
      });

      // The error response should contain the message but be structured
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toContain("Error:");
      // Should not contain raw stack traces
      expect(result.content[0].text).not.toContain("at Object");
      expect(result.content[0].text).not.toContain("at Module");
    });

    it("truncates long HTTP error bodies", async () => {
      const longBody = "SECRET_TOKEN=abc123 ".repeat(100);
      const response = new Response(longBody, {
        status: 500,
        headers: { "content-type": "text/plain" },
      });
      fetchSpy.mockResolvedValueOnce(response);

      const bridge = new AirframeMCPBridge(VALID_API_KEY, "https://example.com/mcp");
      const server = (bridge as any).server;
      const callHandler = Array.from(server._handlers.values())[1] as Function;

      const result = await callHandler({
        params: { name: "test", arguments: {} },
      });

      // Error text should be truncated - the 200-char slice happens in forwardRequest
      const errorText = result.content[0].text;
      expect(errorText.length).toBeLessThan(300);
    });
  });

  describe("Request timeout", () => {
    it("uses AbortSignal.timeout for requests", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockJsonResponse({ jsonrpc: "2.0", id: 1, result: { tools: [] } })
      );

      const bridge = new AirframeMCPBridge(VALID_API_KEY, "https://example.com/mcp");
      const server = (bridge as any).server;
      const listHandler = Array.from(server._handlers.values())[0] as Function;

      await listHandler({});

      const callArgs = fetchSpy.mock.calls[0];
      const options = callArgs[1] as RequestInit;
      expect(options.signal).toBeDefined();
    });
  });

  describe("API key in headers", () => {
    it("sends API key via X-API-Key header, not in URL", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockJsonResponse({ jsonrpc: "2.0", id: 1, result: { tools: [] } })
      );

      const bridge = new AirframeMCPBridge("af_secret_key", "https://example.com/mcp");
      const server = (bridge as any).server;
      const listHandler = Array.from(server._handlers.values())[0] as Function;

      await listHandler({});

      const callArgs = fetchSpy.mock.calls[0];
      const url = callArgs[0] as string;
      const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;

      // Key should be in header
      expect(headers["X-API-Key"]).toBe("af_secret_key");
      // Key should NOT be in URL
      expect(url).not.toContain("af_secret_key");
    });
  });
});
