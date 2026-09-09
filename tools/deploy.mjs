import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DEST = "C:/Users/i5156/Documents/orca/plugins/orca-diaryflow";

mkdirSync(join(DEST, "dist"), { recursive: true });
copyFileSync(join(ROOT, "plugin.json"), join(DEST, "plugin.json"));
copyFileSync(join(ROOT, "package.json"), join(DEST, "package.json"));
copyFileSync(join(ROOT, "icon.png"), join(DEST, "icon.png"));
if (existsSync(join(ROOT, "icon.svg"))) {
  copyFileSync(join(ROOT, "icon.svg"), join(DEST, "icon.svg"));
}
copyFileSync(join(ROOT, "dist", "index.js"), join(DEST, "dist", "index.js"));

console.log("deployed to", DEST);
function walk(d, pre) {
  for (const f of readdirSync(d)) {
    const fp = join(d, f);
    const st = statSync(fp);
    if (st.isDirectory()) walk(fp, pre + f + "/");
    else console.log("  " + pre + f + " (" + st.size + "B)");
  }
}
walk(DEST, "");
