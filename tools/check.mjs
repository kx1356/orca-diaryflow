import { execSync } from "node:child_process";
import { copyFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(ROOT, "dist", "index.js");
const tmp = join(ROOT, "dist", "_check.mjs");
copyFileSync(src, tmp);
try {
  execSync(`node --check "${tmp}"`, { stdio: "inherit" });
  console.log("SYNTAX_OK");
} catch (e) {
  process.exit(1);
} finally {
  try { unlinkSync(tmp); } catch (e) {}
}
