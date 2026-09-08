// 分析编辑器与渲染代码结构，规划标签功能插入点
const fs = require("fs");
const src = fs.readFileSync("E:/Siyuan/One/data/plugins/siyuan-diaryflow/index.js", "utf8");

// 模块位置
const marks = {
  storage: src.indexOf("// src/storage.js"),
  util: src.indexOf("// src/util.js"),
  render: src.indexOf("// src/render.js"),
  export: src.indexOf("// src/export.js"),
  editor: src.indexOf("// src/editor.js"),
  index: src.indexOf("// src/index.js"),
};
console.log("模块标记:", JSON.stringify(marks));

const editor = src.slice(marks.editor, marks.index);
const render = src.slice(marks.render, marks.export);

// 1. 编辑器：发表表单结构
console.log("\n=== editor.js 关键函数 ===");
for (const fn of ["openEditor", "renderEditor", "buildEditor", "renderEditorModal"]) {
  const i = editor.indexOf("function " + fn);
  if (i >= 0) console.log(fn, "@", i);
}

// 2. render.js 条目模板
console.log("\n=== render.js 关键函数 ===");
for (const fn of ["renderItem", "itemHtml", "feedItem", "renderFeed", "renderPinnedStrip"]) {
  let i = -1;
  while ((i = render.indexOf("function " + fn, i + 1)) >= 0) console.log(fn, "@", i);
}

// 3. storage normalizeItem —— 需要加 tags 字段
const stg = src.slice(marks.storage, marks.util);
console.log("\n=== storage normalizeItem ===");
const ni = stg.indexOf("function normalizeItem");
console.log(stg.slice(ni, ni + 900));

// 4. 搜索过滤逻辑（filters.kw）
console.log("\n=== 过滤/搜索逻辑 ===");
let f = render.indexOf("filters.kw");
while (f >= 0) {
  console.log("@", f, ":", JSON.stringify(render.slice(Math.max(0, f - 120), f + 150)));
  f = render.indexOf("filters.kw", f + 1);
}