// 1. storage.js 模块完整内容（找 key 和 save 逻辑）
// 2. mreader 的 getData/setData 调用方式
const fs = require("fs");
const src = fs.readFileSync("E:/Siyuan/One/data/plugins/siyuan-diaryflow/index.js", "utf8");
const sStart = src.indexOf("// src/storage.js");
const sEnd = src.indexOf("// src/util.js");
console.log("=== storage.js 模块（完整） ===");
console.log(src.slice(sStart, sEnd));

console.log("\n=== mreader getData/setData 用法 ===");
const m = fs.readFileSync("C:/Users/i5156/Documents/orca/plugins/mreader/dist/index.js", "utf8");
for (const kw of ["plugins.getData", "plugins.setData", "get-plugin-data", "set-plugin-data"]) {
  let i = -1;
  let n = 0;
  while ((i = m.indexOf(kw, i + 1)) >= 0 && n < 4) {
    n++;
    console.log("--- " + kw + " @ " + i);
    console.log(m.slice(Math.max(0, i - 200), i + 250));
    console.log();
  }
  if (!n) console.log("--- " + kw + " NOT FOUND\n");
}
