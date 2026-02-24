#!/usr/bin/env node
/**
 * Build script to create standalone bundle with proper shebang
 */
import * as esbuild from "esbuild";
import { readFileSync, writeFileSync, chmodSync } from "fs";

async function build() {
  // Bundle with esbuild
  await esbuild.build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: "dist/airframe-mcp-client.js",
    minify: false,
    target: "node18",
  });

  // Read the bundled file
  const content = readFileSync("dist/airframe-mcp-client.js", "utf-8");

  // Add shebang at the very beginning
  const withShebang = `#!/usr/bin/env node\n${content}`;

  // Write back
  writeFileSync("dist/airframe-mcp-client.js", withShebang);

  // Make executable
  chmodSync("dist/airframe-mcp-client.js", 0o755);

  console.log("✓ Built dist/airframe-mcp-client.js (standalone bundle)");
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
