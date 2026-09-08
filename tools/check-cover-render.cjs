// 1. render 模板中封面区域的原始代码  2. P11 补丁内容  3. dist 中实际封面代码
const fs = require("fs");
const src = fs.readFileSync("E:/Siyuan/One/data/plugins/siyuan-diaryflow/index.js", "utf8");
const dist = fs.readFileSync("C:/Users/i5156/Documents/orca/plugins/orca-diaryflow/dist/index.js", "utf8");

console.log("=== 1. 源码 mom-cover-bg 模板 ===");
let i = src.indexOf("mom-cover-bg");
while (i >= 0) {
  const ctx = src.slice(Math.max(0, i - 200), i + 400);
  if (ctx.includes("cover") && (ctx.includes("${") || ctx.includes("html"))) {
    console.log("@ " + i + ":");
    console.log(ctx);
    console.log();
  }
  i = src.indexOf("mom-cover-bg", i + 1);
}

console.log("\n=== 2. P11-coversrc 补丁 ===");
console.log("--- find ---");
console.log(fs.readFileSync("C:/Users/i5156/AppData/Roaming/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a866bb5ecf6cdbfe97f12e7/orca-diaryflow/patches/P11-coversrc.find.txt", "utf8"));
console.log("--- replace ---");
console.log(fs.readFileSync("C:/Users/i5156/AppData/Roaming/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a866bb5ecf6cdbfe97f12e7/orca-diaryflow/patches/P11-coversrc.replace.txt", "utf8"));

console.log("\n=== 3. dist 中封面渲染代码 ===");
const d1 = dist.indexOf("mom-cover-bg");
if (d1 >= 0) console.log(dist.slice(Math.max(0, d1 - 300), d1 + 500));

console.log("\n=== 4. dist 中 applyCoverDom 调用处（初始渲染时是否调用） ===");
let j = dist.indexOf("applyCoverDom");
while (j >= 0) {
  console.log("@ " + j + ":", JSON.stringify(dist.slice(Math.max(0, j - 150), j + 200)));
  j = dist.indexOf("applyCoverDom", j + 1);
}
