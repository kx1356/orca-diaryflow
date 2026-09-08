// 深入检查 render 模块的导出与 renderApp 定义
const fs = require("fs");
const path = require("path");
const t = fs.readFileSync(path.join(__dirname, "..", "dist", "index.js"), "utf8");

const rStart = t.indexOf("// src/render.js");
const rEnd = t.indexOf("// src/export.js");
const seg = t.slice(rStart, rEnd);
console.log("render module length:", seg.length);

// module2.exports 位置
let i = -1;
while ((i = seg.indexOf("module2.exports", i + 1)) >= 0) {
  console.log("\n=== module2.exports @ seg+" + i + " ===");
  console.log(JSON.stringify(seg.slice(i - 200, i + 150)));
}

// renderApp 定义
let j = -1;
while ((j = seg.indexOf("renderApp", j + 1)) >= 0) {
  console.log("\n=== renderApp @ seg+" + j + " ===");
  console.log(JSON.stringify(seg.slice(j - 80, j + 120)));
}

// 原始源码（思源 bundle）里 src/index.js 模块怎么用 render
const src = fs.readFileSync("E:/Siyuan/One/data/plugins/siyuan-diaryflow/index.js", "utf8");
const iStart = src.indexOf("// src/index.js");
const iSeg = src.slice(iStart);
console.log("\n=== original src/index.js module (first 3000) ===");
console.log(iSeg.slice(0, 3000));
