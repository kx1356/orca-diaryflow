// 精确提取「资源」按钮整行（含前后换行与缩进）
const fs = require("fs");
const t = fs.readFileSync("E:/Siyuan/One/data/plugins/siyuan-diaryflow/index.js", "utf8");
const i = t.indexOf('data-act="resource"');
console.log("anchor @", i);
// 向前找本行行首，向后找本行行尾
const lineStart = t.lastIndexOf("\n", i) + 1;
const lineEnd = t.indexOf("\n", i);
const line = t.slice(lineStart, lineEnd);
console.log("line:", JSON.stringify(line));
console.log("length:", line.length);
// 确认唯一性
let j = -1;
let n = 0;
while ((j = t.indexOf('data-act="resource"', j + 1)) >= 0) n++;
console.log("occurrences of data-act=resource:", n);
