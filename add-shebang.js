#!/usr/bin/env node
/**
 * Add shebang to built TypeScript output
 */
import { readFileSync, writeFileSync, chmodSync } from "fs";

const file = "dist/index.js";
const content = readFileSync(file, "utf-8");

if (!content.startsWith("#!/usr/bin/env node")) {
  const withShebang = `#!/usr/bin/env node\n${content}`;
  writeFileSync(file, withShebang);
  chmodSync(file, 0o755);
  console.log("✓ Added shebang to dist/index.js");
} else {
  console.log("✓ Shebang already present in dist/index.js");
}
