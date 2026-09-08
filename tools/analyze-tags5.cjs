// cardHtml 完整 + textHtml 周边 + metaTags/actions 定义
const fs = require("fs");
const src = fs.readFileSync("E:/Siyuan/One/data/plugins/siyuan-diaryflow/index.js", "utf8");
const marks = { render: src.indexOf("// src/render.js"), export: src.indexOf("// src/export.js") };
const render = src.slice(marks.render, marks.export);

const ci = render.indexOf("function cardHtml");
console.log("=== cardHtml（全文） ===");
console.log(render.slice(ci, ci + 1600));

// meta 区域（上段输出截断处后面）
const mi = render.indexOf("north-luna-moments-item-meta");
console.log("\n=== meta 区域 ===");
console.log(render.slice(mi, mi + 1200));

// textHtml 与 renderInlineMd
console.log("\n=== renderInlineMd 定义 ===");
const x = render.indexOf("function renderInlineMd");
if (x >= 0) console.log(render.slice(x, x + 900));