import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseCliArgs } from "../src/index.js";

describe("parseCliArgs", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("parses --api-key correctly", () => {
    const result = parseCliArgs(["--api-key", "af_test123"]);
    expect(result).toEqual({
      apiKey: "af_test123",
      serverUrl: "https://mcp.airframe.ai/mcp",
    });
  });

  it("parses --api-key and --server-url together", () => {
    const result = parseCliArgs([
      "--api-key",
      "af_test123",
      "--server-url",
      "https://custom.example.com/mcp",
    ]);
    expect(result).toEqual({
      apiKey: "af_test123",
      serverUrl: "https://custom.example.com/mcp",
    });
  });

  it("uses default server URL when --server-url is omitted", () => {
    const result = parseCliArgs(["--api-key", "af_test123"]);
    expect(result?.serverUrl).toBe("https://mcp.airframe.ai/mcp");
  });

  it("returns null for --help", () => {
    expect(parseCliArgs(["--help"])).toBeNull();
  });

  it("returns null for -h", () => {
    expect(parseCliArgs(["-h"])).toBeNull();
  });

  it("throws when --api-key is missing", () => {
    expect(() => parseCliArgs([])).toThrow("--api-key is required");
  });

  it("throws when --api-key has no value", () => {
    expect(() => parseCliArgs(["--api-key"])).toThrow("--api-key is required");
  });

  it("throws for invalid --server-url", () => {
    expect(() =>
      parseCliArgs(["--api-key", "af_test", "--server-url", "not-a-url"])
    ).toThrow("not a valid URL");
  });

  it("throws for blocked --server-url", () => {
    expect(() =>
      parseCliArgs(["--api-key", "af_test", "--server-url", "http://localhost/x"])
    ).toThrow("internal/private");
  });

  it("throws for non-http --server-url", () => {
    expect(() =>
      parseCliArgs(["--api-key", "af_test", "--server-url", "ftp://example.com"])
    ).toThrow("http or https");
  });

  it("warns when API key doesn't start with af_", () => {
    const result = parseCliArgs(["--api-key", "bad_prefix_key"]);
    expect(result?.apiKey).toBe("bad_prefix_key");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Warning: API key should start with 'af_'"
    );
  });

  it("handles args in any order", () => {
    const result = parseCliArgs([
      "--server-url",
      "https://custom.example.com/mcp",
      "--api-key",
      "af_test123",
    ]);
    expect(result).toEqual({
      apiKey: "af_test123",
      serverUrl: "https://custom.example.com/mcp",
    });
  });
});
