// 修复 build.mjs 的 join("") 为 join("\n")
const fs = require("fs");
const p = "C:/Users/i5156/AppData/Roaming/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a866bb5ecf6cdbfe97f12e7/orca-diaryflow/build.mjs";
let t = fs.readFileSync(p, "utf8");
const before = t;
const target = "].join(\"\");";
const i = t.indexOf(target);
console.log("found join-empty @", i);
if (i < 0) {
  console.log("ALREADY FIXED or not found");
  process.exit(0);
}
t = t.replace(target, "].join(\"\\n\");");
fs.writeFileSync(p, t);
console.log("patched:", before !== t);
console.log("verify:", t.includes("].join(\"\\n\");"));
