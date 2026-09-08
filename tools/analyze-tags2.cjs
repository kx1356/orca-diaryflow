// 深入编辑器与条目渲染
const fs = require("fs");
const src = fs.readFileSync("E:/Siyuan/One/data/plugins/siyuan-diaryflow/index.js", "utf8");
const marks = {
  storage: src.indexOf("// src/storage.js"),
  util: src.indexOf("// src/util.js"),
  render: src.indexOf("// src/render.js"),
  export: src.indexOf("// src/export.js"),
  editor: src.indexOf("// src/editor.js"),
  index: src.indexOf("// src/index.js"),
};
const editor = src.slice(marks.editor, marks.index);
const render = src.slice(marks.render, marks.export);

// 1. openEditor 完整实现
console.log("=== openEditor ===");
const oi = editor.indexOf("function openEditor");
console.log(editor.slice(oi, oi + 3500));

// 2. 条目 item 渲染（找 mom-item / mom-card 模板）
console.log("\n\n=== 条目渲染模板 ===");
let idx = render.indexOf("mom-item");
while (idx >= 0 && idx < 40000) {
  const ctx = render.slice(Math.max(0, idx - 50), idx + 400);
  if (ctx.includes("class=") && ctx.includes("`")) {
    console.log("--- @", idx, "---");
    console.log(ctx.slice(0, 450));
    console.log();
  }
  idx = render.indexOf("mom-item", idx + 20);
}

// 3. 搜索过滤实现
console.log("=== 搜索 ===");
let f = render.indexOf(".indexOf(kw)");
if (f < 0) f = render.indexOf("filters.kw");
let n = 0;
while (f >= 0 && n < 8) {
  console.log("@", f, ":", JSON.stringify(render.slice(Math.max(0, f - 200), f + 200)));
  f = render.indexOf("filters.kw", f + 1);
  n++;
}