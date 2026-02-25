import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";

const execFileAsync = promisify(execFile);

// Use tsx to run the TS source directly
const projectRoot = path.resolve(fileURLToPath(import.meta.url), "../..");
const entryPoint = path.join(projectRoot, "src/index.ts");
const tsxBin = path.join(projectRoot, "node_modules/.bin/tsx");

async function runCli(
  args: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execFileAsync(tsxBin, [entryPoint, ...args], {
      timeout: 10000,
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || "",
      stderr: error.stderr || "",
      exitCode: error.code ?? 1,
    };
  }
}

describe("CLI E2E", () => {
  it("exits with code 1 when --api-key is missing", async () => {
    const result = await runCli([]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--api-key is required");
  });

  it("exits with code 0 for --help", async () => {
    const result = await runCli(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Airframe MCP Client");
    expect(result.stdout).toContain("--api-key");
  });

  it("exits with code 0 for -h", async () => {
    const result = await runCli(["-h"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Airframe MCP Client");
  });

  it("exits with code 1 for invalid --server-url", async () => {
    const result = await runCli([
      "--api-key",
      "af_test",
      "--server-url",
      "not-a-url",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("not a valid URL");
  });

  it("exits with code 1 for blocked --server-url", async () => {
    const result = await runCli([
      "--api-key",
      "af_test",
      "--server-url",
      "http://localhost/mcp",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("internal/private");
  });

  it("exits with code 1 for non-http --server-url", async () => {
    const result = await runCli([
      "--api-key",
      "af_test",
      "--server-url",
      "ftp://example.com",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("http or https");
  });
});
