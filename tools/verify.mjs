import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const t = readFileSync(join(ROOT, "dist", "index.js"), "utf8");

console.log("1. ICONS svg path:", t.includes("M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"));
console.log("2. no <use> tags:", !t.includes("use xlink"));
console.log("3. ASSET_PREFIX:", t.includes('const ASSET_PREFIX = "dfasset://media/"'));
console.log("4. DF_ASSETS global:", t.includes("globalThis.__DF_ASSETS = DF_ASSETS"));
console.log("5. export load/unload:", t.includes("export { load, unload }"));
console.log("6. registerPanel:", t.includes("orca.panels.registerPanel"));
console.log("7. theme vars:", t.includes(".orca-df-scope.orca-df-dark"));
console.log("8. toDataUrl export patch:", t.includes("toDataUrl(__ref)"));
console.log("9. overlay scope:", t.includes("mom-overlay orca-df-scope"));

const m = t.match(/\.mom-root\s*\{[^}]*\}/g);
console.log("10. .mom-root rules:", m ? m.length : 0);
if (m) m.slice(0, 3).forEach((x) => console.log("   ", x.replace(/\s+/g, " ").slice(0, 160)));
const m2 = t.match(/\.mom-scroll\s*\{[^}]*\}/g);
console.log("11. .mom-scroll rules:", m2 ? m2.length : 0);
if (m2) m2.slice(0, 2).forEach((x) => console.log("   ", x.replace(/\s+/g, " ").slice(0, 200)));
const m3 = t.match(/\.mom-overlay\s*\{[^}]*\}/g);
console.log("12. .mom-overlay rules:", m3 ? m3.length : 0);
if (m3) m3.slice(0, 1).forEach((x) => console.log("   ", x.replace(/\s+/g, " ").slice(0, 200)));
