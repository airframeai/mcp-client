import { vi } from "vitest";

/** Create a mock Response object with JSON body */
export function mockJsonResponse(body: unknown, status = 200): Response {
  const text = JSON.stringify(body);
  return new Response(text, {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Create a mock Response with text/event-stream SSE body */
export function mockSSEResponse(events: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(event + "\n"));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

/** Build an SSE data line from an object */
export function sseDataLine(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}`;
}

/** Create an SSE progress notification event */
export function sseProgressEvent(
  progressToken: string,
  progress: number,
  total: number
): string {
  return sseDataLine({
    jsonrpc: "2.0",
    method: "notifications/progress",
    params: { progressToken, progress, total },
  });
}

/** Create an SSE final result event */
export function sseFinalResult(id: number | string, result: unknown): string {
  return sseDataLine({
    jsonrpc: "2.0",
    id,
    result,
  });
}

/** Create a mock HTTP error response */
export function mockErrorResponse(status: number, text: string): Response {
  return new Response(text, {
    status,
    statusText: text,
    headers: { "content-type": "text/plain" },
  });
}

/** Create a mock MCP Server with spied methods */
export function createMockServer() {
  const handlers = new Map<string, Function>();
  return {
    setRequestHandler: vi.fn((schema: any, handler: Function) => {
      handlers.set(schema?.method || schema, handler);
    }),
    notification: vi.fn(),
    connect: vi.fn(),
    _handlers: handlers,
  };
}
