import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AirframeMCPBridge } from "../src/index.js";
import { VALID_API_KEY, DEFAULT_SERVER_URL } from "./helpers/fixtures.js";
import {
  mockSSEResponse,
  sseDataLine,
  sseProgressEvent,
  sseFinalResult,
} from "./helpers/mocks.js";

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

describe("SSE Streaming", () => {
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

  function getCallHandler(bridge: AirframeMCPBridge): Function {
    const server = (bridge as any).server;
    return Array.from(server._handlers.values())[1] as Function;
  }

  it("parses SSE stream with progress and final result", async () => {
    const sseEvents = [
      sseProgressEvent("tok-1", 1, 3),
      "",
      sseProgressEvent("tok-1", 2, 3),
      "",
      sseFinalResult(1, {
        content: [{ type: "text", text: "final answer" }],
      }),
      "",
    ];

    fetchSpy.mockResolvedValueOnce(mockSSEResponse(sseEvents));
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "tok-1" as `${string}-${string}-${string}-${string}-${string}`
    );

    const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
    const callHandler = getCallHandler(bridge);

    const result = await callHandler({
      params: { name: "search_products", arguments: {} },
    });

    expect(result.content[0].text).toBe("final answer");
  });

  it("forwards progress notifications to MCP client", async () => {
    const sseEvents = [
      sseProgressEvent("tok-1", 1, 2),
      "",
      sseFinalResult(1, {
        content: [{ type: "text", text: "done" }],
      }),
      "",
    ];

    fetchSpy.mockResolvedValueOnce(mockSSEResponse(sseEvents));
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "tok-1" as `${string}-${string}-${string}-${string}-${string}`
    );

    const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
    const server = (bridge as any).server;
    const callHandler = getCallHandler(bridge);

    await callHandler({
      params: { name: "search_products", arguments: {} },
    });

    expect(server.notification).toHaveBeenCalledWith({
      method: "notifications/progress",
      params: expect.objectContaining({
        progressToken: "tok-1",
        progress: 1,
        total: 2,
      }),
    });
  });

  it("handles SSE stream with only final result (no progress)", async () => {
    const sseEvents = [
      sseFinalResult(1, {
        content: [{ type: "text", text: "immediate" }],
      }),
      "",
    ];

    fetchSpy.mockResolvedValueOnce(mockSSEResponse(sseEvents));

    const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
    const callHandler = getCallHandler(bridge);

    const result = await callHandler({
      params: { name: "test", arguments: {} },
    });

    expect(result.content[0].text).toBe("immediate");
  });

  it("handles malformed SSE data gracefully", async () => {
    const sseEvents = [
      "data: {invalid json}",
      "",
      sseFinalResult(1, {
        content: [{ type: "text", text: "ok" }],
      }),
      "",
    ];

    fetchSpy.mockResolvedValueOnce(mockSSEResponse(sseEvents));

    const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
    const callHandler = getCallHandler(bridge);

    const result = await callHandler({
      params: { name: "test", arguments: {} },
    });

    // Should log error for bad parse but still return final result
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to parse SSE data")
    );
    expect(result.content[0].text).toBe("ok");
  });

  it("returns error when SSE stream has no final result", async () => {
    const sseEvents = [
      sseProgressEvent("tok-1", 1, 2),
      "",
    ];

    fetchSpy.mockResolvedValueOnce(mockSSEResponse(sseEvents));

    const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
    const callHandler = getCallHandler(bridge);

    const result = await callHandler({
      params: { name: "test", arguments: {} },
    });

    // forwardRequest catches the error and returns error content
    expect(result.content[0].text).toContain("No final result received");
  });

  it("ignores empty data lines", async () => {
    const sseEvents = [
      "data: ",
      "",
      sseFinalResult(1, {
        content: [{ type: "text", text: "ok" }],
      }),
      "",
    ];

    fetchSpy.mockResolvedValueOnce(mockSSEResponse(sseEvents));

    const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
    const callHandler = getCallHandler(bridge);

    const result = await callHandler({
      params: { name: "test", arguments: {} },
    });

    expect(result.content[0].text).toBe("ok");
  });

  it("handles SSE stream with no body", async () => {
    const response = new Response(null, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
    // Override body to null
    Object.defineProperty(response, "body", { value: null });

    fetchSpy.mockResolvedValueOnce(response);

    const bridge = new AirframeMCPBridge(VALID_API_KEY, DEFAULT_SERVER_URL);
    const callHandler = getCallHandler(bridge);

    const result = await callHandler({
      params: { name: "test", arguments: {} },
    });

    expect(result.content[0].text).toContain("No response body");
  });
});
