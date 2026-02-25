import { describe, it, expect } from "vitest";
import { validateServerUrl } from "../src/index.js";
import { BLOCKED_URLS, VALID_URLS } from "./helpers/fixtures.js";

describe("validateServerUrl", () => {
  describe("blocks dangerous URLs", () => {
    const cases: [string, string][] = [
      ["http://localhost/mcp", "internal/private"],
      ["http://127.0.0.1/mcp", "internal/private"],
      ["http://0.0.0.0/mcp", "internal/private"],
      ["http://[::1]/mcp", "internal/private"],
      ["http://169.254.169.254/latest/meta-data", "internal/private"],
      ["http://foo.internal/mcp", "internal/private"],
      ["http://10.0.0.1/mcp", "internal/private"],
      ["http://192.168.1.1/mcp", "internal/private"],
      ["http://172.16.0.1/mcp", "internal/private"],
      ["http://172.31.255.255/mcp", "internal/private"],
    ];

    it.each(cases)("rejects %s", (url, _reason) => {
      const result = validateServerUrl(url);
      expect(result).not.toBeNull();
      expect(result).toContain("internal/private");
    });
  });

  describe("blocks non-http protocols", () => {
    it("rejects ftp://", () => {
      const result = validateServerUrl("ftp://example.com/mcp");
      expect(result).toContain("http or https");
    });

    it("rejects file://", () => {
      const result = validateServerUrl("file:///etc/passwd");
      expect(result).toContain("http or https");
    });
  });

  describe("rejects invalid URLs", () => {
    it("rejects empty string", () => {
      const result = validateServerUrl("");
      expect(result).toContain("not a valid URL");
    });

    it("rejects random text", () => {
      const result = validateServerUrl("not-a-url");
      expect(result).toContain("not a valid URL");
    });
  });

  describe("accepts valid URLs", () => {
    it.each(VALID_URLS)("accepts %s", (url) => {
      expect(validateServerUrl(url)).toBeNull();
    });
  });

  describe("edge cases for RFC 1918 ranges", () => {
    it("rejects 172.16.0.1 (start of range)", () => {
      expect(validateServerUrl("http://172.16.0.1/x")).toContain("internal/private");
    });

    it("rejects 172.31.0.1 (end of range)", () => {
      expect(validateServerUrl("http://172.31.0.1/x")).toContain("internal/private");
    });

    it("allows 172.15.0.1 (below range)", () => {
      expect(validateServerUrl("http://172.15.0.1/x")).toBeNull();
    });

    it("allows 172.32.0.1 (above range)", () => {
      expect(validateServerUrl("http://172.32.0.1/x")).toBeNull();
    });
  });
});
