// 找 feed 条目列表渲染
const fs = require("fs");
const src = fs.readFileSync("E:/Siyuan/One/data/plugins/siyuan-diaryflow/index.js", "utf8");
const marks = { render: src.indexOf("// src/render.js"), export: src.indexOf("// src/export.js") };
const render = src.slice(marks.render, marks.export);

// 找 renderList 后续，以及真正的 feed item 模板
const ri = render.indexOf("function renderList");
console.log("renderList @", ri);
console.log(render.slice(ri, ri + 900));

console.log("\n\n=== 17690 区域（第二个 map） ===");
console.log(render.slice(17600, 17690 + 3000));