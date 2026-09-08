// 1. 源码里 esc 定义有几处  2. render 模块怎么引用 esc  3. dist 里 P06 补丁是否生效
const fs = require("fs");
const src = fs.readFileSync("E:/Siyuan/One/data/plugins/siyuan-diaryflow/index.js", "utf8");
const dist = fs.readFileSync("C:/Users/i5156/Documents/orca/plugins/orca-diaryflow/dist/index.js", "utf8");

console.log("=== 1. 源码 esc 定义 ===");
let i = -1;
while ((i = src.indexOf("function esc(", i + 1)) >= 0) {
  console.log("@ " + i + ":", JSON.stringify(src.slice(i, i + 200)));
}

console.log("\n=== 2. render 模块块头（看它 require 了什么） ===");
const rStart = src.indexOf("// src/render.js");
const rEnd = src.indexOf("// src/export.js");
const renderHead = src.slice(rStart, rStart + 800);
console.log(renderHead);

console.log("\n=== 3. dist 中 esc 定义（P06 生效确认） ===");
let j = -1;
while ((j = dist.indexOf("function esc(", j + 1)) >= 0) {
  console.log("@ " + j + ":", JSON.stringify(dist.slice(j, j + 260)));
}

console.log("\n=== 4. dist 中 __DF_ASSETS.resolve 出现处 ===");
let k = -1;
while ((k = dist.indexOf("__DF_ASSETS.resolve", k + 1)) >= 0) {
  console.log("@ " + k + ":", JSON.stringify(dist.slice(Math.max(0, k - 120), k + 80)));
}
