import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AirframeMCPBridge, MAX_RESPONSE_SIZE } from "../src/index.js";
import { VALID_API_KEY, DEFAULT_SERVER_URL } from "./helpers/fixtures.js";
import { mockJsonResponse, mockErrorResponse } from "./helpers/mocks.js";

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

describe("Error Handling", () => {
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

  function getListHandler(bridge: AirframeMCPBridge): Function {
    const server = (bridge as any).server;
    return Array.from(server._handlers.values())[0] as Function;
  }

  function getCallHandler(bridge: AirframeMCPBridge): Function {
    const server = (bridge as any).server;
    return Array.from(server._handlers.values())[1] as Function;
  }

  describe("HTTP errors", () => {
    it("handles 401 Unauthorized", async () => {
      fetchSpy.mockResolvedValueOnce(mockErrorResponse(401, "Unauthorized"));

      const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
      const handler = getListHandler(bridge);

      // tools/list handler throws on error responses
      await expect(handler({})).rejects.toThrow("HTTP 401");
    });

    it("handles 500 Internal Server Error", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockErrorResponse(500, "Internal Server Error")
      );

      const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
      const handler = getListHandler(bridge);

      await expect(handler({})).rejects.toThrow("HTTP 500");
    });

    it("handles 404 Not Found", async () => {
      fetchSpy.mockResolvedValueOnce(mockErrorResponse(404, "Not Found"));

      const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
      const handler = getListHandler(bridge);

      await expect(handler({})).rejects.toThrow("HTTP 404");
    });

    it("truncates long error response text to 200 chars", async () => {
      const longBody = "x".repeat(500);
      fetchSpy.mockResolvedValueOnce(mockErrorResponse(400, longBody));

      const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
      const handler = getCallHandler(bridge);

      const result = await handler({
        params: { name: "test", arguments: {} },
      });

      // The error message in the returned content should contain the truncated text
      const errorText = result.content[0].text;
      // "HTTP 400: " prefix + 200 chars = truncated
      expect(errorText).toContain("HTTP 400");
      // The raw body passed to Error is sliced to 200
      expect(errorText.length).toBeLessThan(250);
    });
  });

  describe("Network failures", () => {
    it("handles fetch rejection (network error)", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("fetch failed"));

      const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
      const handler = getCallHandler(bridge);

      const result = await handler({
        params: { name: "test", arguments: {} },
      });

      expect(result.content[0].text).toContain("fetch failed");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("fetch failed")
      );
    });

    it("handles non-Error thrown values", async () => {
      fetchSpy.mockRejectedValueOnce("string error");

      const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
      const handler = getCallHandler(bridge);

      const result = await handler({
        params: { name: "test", arguments: {} },
      });

      expect(result.content[0].text).toContain("string error");
    });
  });

  describe("JSON parse errors", () => {
    it("handles invalid JSON response", async () => {
      const response = new Response("not json at all!", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
      fetchSpy.mockResolvedValueOnce(response);

      const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
      const handler = getCallHandler(bridge);

      const result = await handler({
        params: { name: "test", arguments: {} },
      });

      // JSON.parse error gets caught by forwardRequest
      expect(result.content[0].text).toContain("Error");
    });
  });

  describe("Response size limit", () => {
    it("rejects responses exceeding MAX_RESPONSE_SIZE", async () => {
      // Create a response that claims to be larger than MAX_RESPONSE_SIZE
      const hugeText = "x".repeat(MAX_RESPONSE_SIZE + 1);
      const response = new Response(hugeText, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
      fetchSpy.mockResolvedValueOnce(response);

      const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
      const handler = getCallHandler(bridge);

      const result = await handler({
        params: { name: "test", arguments: {} },
      });

      expect(result.content[0].text).toContain(
        "Response exceeded maximum allowed size"
      );
    });

    it("accepts responses within MAX_RESPONSE_SIZE", async () => {
      const validResponse = { jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: "ok" }] } };
      fetchSpy.mockResolvedValueOnce(mockJsonResponse(validResponse));

      const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
      const handler = getCallHandler(bridge);

      const result = await handler({
        params: { name: "test", arguments: {} },
      });

      expect(result.content[0].text).toBe("ok");
    });
  });

  describe("Error logging", () => {
    it("logs errors to stderr", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("connection refused"));

      const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
      const handler = getCallHandler(bridge);

      await handler({ params: { name: "test", arguments: {} } });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Airframe MCP] Error: connection refused"
      );
    });
  });
});
