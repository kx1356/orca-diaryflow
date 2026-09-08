// 编辑器保存逻辑 + 条目渲染模板
const fs = require("fs");
const src = fs.readFileSync("E:/Siyuan/One/data/plugins/siyuan-diaryflow/index.js", "utf8");
const marks = {
  render: src.indexOf("// src/render.js"),
  export: src.indexOf("// src/export.js"),
  editor: src.indexOf("// src/editor.js"),
  index: src.indexOf("// src/index.js"),
};
const editor = src.slice(marks.editor, marks.index);
const render = src.slice(marks.render, marks.export);

// 1. openEditor 保存逻辑后半段
console.log("=== openEditor 保存部分 ===");
const oi = editor.indexOf("function openEditor");
const seg = editor.slice(oi, oi + 6500);
const saveAt = seg.indexOf("d.text = text");
console.log(seg.slice(saveAt, saveAt + 1600));

// 2. 条目渲染：找 mom-item / mom-feed / mom-card 类
console.log("\n=== render 中的 item 模板 ===");
for (const kl of ["mom-item", "mom-card", "mom-feed-item", "mom-entry"]) {
  let i = -1;
  const poses = [];
  while ((i = render.indexOf(kl, i + 1)) >= 0) poses.push(i);
  console.log(kl + ":", poses.slice(0, 5).join(", "));
}

// 找渲染条目的函数：通常有 items.map
let m = render.indexOf(".map(");
let n = 0;
const candidates = [];
while (m >= 0 && n < 30) {
  const before = render.slice(Math.max(0, m - 150), m);
  if (/items|records|filtered|sorted/.test(before)) {
    candidates.push(m);
  }
  m = render.indexOf(".map(", m + 1);
  n++;
}
console.log("\nitems.map 候选:", candidates.slice(0, 8).join(", "));
if (candidates.length) {
  const c = candidates[0];
  console.log("\n=== item map 模板（前 2500 字符） ===");
  console.log(render.slice(c - 200, c + 2500));
}