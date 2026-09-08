// metaTags 实现 + 编辑器 info 卡精确文本
const fs = require("fs");
const src = fs.readFileSync("E:/Siyuan/One/data/plugins/siyuan-diaryflow/index.js", "utf8");
const marks = { render: src.indexOf("// src/render.js"), export: src.indexOf("// src/export.js"), editor: src.indexOf("// src/editor.js"), index: src.indexOf("// src/index.js") };
const render = src.slice(marks.render, marks.export);
const editor = src.slice(marks.editor, marks.index);

// metaTags
const mt = render.indexOf("function metaTags");
console.log("=== metaTags ===");
if (mt >= 0) console.log(render.slice(mt, mt + 800));
else console.log("(未找到，搜 meta 定义)");

// actionsHtml（确认 meta/actions 顺序）
const ah = render.indexOf("function actionsHtml");
if (ah >= 0) console.log("\n=== actionsHtml ===", render.slice(ah, ah + 500));

// 编辑器 info 卡精确文本（字节级）
console.log("\n=== 编辑器 info 卡 —— 原始字节 ===");
const di = editor.indexOf("data-location");
const seg = editor.slice(di - 320, di + 130);
console.log(JSON.stringify(seg));

// d 初始化行
console.log("\n=== d 初始化行 ===");
const dInit = editor.indexOf('const d = { text:');
console.log(JSON.stringify(editor.slice(dInit, dInit + 150)));

// 保存解析处
console.log("\n=== 保存解析处 ===");
const sv = editor.indexOf('d.location = q("[data-location]")');
console.log(JSON.stringify(editor.slice(sv - 40, sv + 120)));

// cardHtml 的 textHtml/expandHtml 行
console.log("\n=== cardHtml 模板行 ===");
const ct = src.indexOf("function cardHtml");
const car = src.slice(ct, ct + 700);
console.log(JSON.stringify(car.match(/\$\{textHtml.*\$\{expandHtml.*\$\{mediaHtml.*\$\{metaTags.*\}[\s\S]*?\$\{actionsHtml.*\}/, ) || []));