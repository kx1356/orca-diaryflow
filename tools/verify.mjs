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
console.log("7b. host fills panel:", t.includes("align-self: stretch") && t.includes("orca-diaryflow-style-v12"));
console.log("7l. fab tag filter:", t.includes("open-tag-filter") && t.includes("mom-tag-fab") && t.includes("ico(\"label\""));
console.log("7m. resolve orca asset src:", t.includes("dfResolveOrcaAssetSrc") && t.includes("file:///"));
console.log("7j. calendar by settings:", t.includes("mom-cover-actions") && t.includes("mom-cover-cal"));
console.log("7k. sync images to orca:", t.includes("upload-asset-binary") && t.includes("syncImagesToBlock") && t.includes("dfSyncImagesToBlock"));
console.log("7c. deep fusion blocks:", t.includes("__DF_ORCA_BLOCKS") && t.includes("get-blocks-with-tags"));
console.log("7d. light compose (plan C):", t.includes("orcaOpenCompose") && t.includes("updateEntry") && t.includes("orcaPersistComposeDraft"));
console.log("7e. search/tag UI:", t.includes("orca-df-search") && t.includes("orca-df-tagbar"));
console.log("7f. editor context guard:", t.includes("dfWithEditor") && t.includes("dfFindEditorPanelId"));
console.log("7g. open in Orca:", t.includes("在虎鲸中打开") && t.includes("orcaOpenInOrca"));
console.log("7h. no embed BlockPanel path:", !t.includes("orca-df-edit-shell") && !t.includes("panelRenderers.block"));
console.log("7i. strip tags from card text:", t.includes("OB.stripInlineTagText") && t.includes("#[^\\s#"));
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
