// 验证 P25 find 文件与源文件精确字节匹配，并新提取 delete 行
const fs = require("fs");
const src = fs.readFileSync("E:/Siyuan/One/data/plugins/siyuan-diaryflow/index.js", "utf8");
const base = "C:/Users/i5156/AppData/Roaming/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a866bb5ecf6cdbfe97f12e7/orca-diaryflow/patches/";

// 1. P25 find 文件实际字节 (逐个字符打印，区分汉字与 \u 字面量)
const pf = fs.readFileSync(base + "P25-rmupload.find.txt", "utf8");
console.log("=== P25 find 前 120 字符（unicode 码点） ===");
for (let i = 0; i < Math.min(pf.length, 120); i++) {
  const c = pf[i];
  process.stdout.write(c === "\n" ? "\\n" : (c.charCodeAt(0) > 127 ? `[U+${c.charCodeAt(0).toString(16)}]` : c));
}
console.log("\n");

// 2. 源文件 upload 行的原始字节（字符级）
const u = src.indexOf('data-act="upload"');
const lineStart = src.lastIndexOf("\n", u);
const lineEnd = src.indexOf("\n", u);
const upLine = src.slice(lineStart, lineEnd + 1); // 含前导\n和尾部\n
console.log("=== 源文件 upload 行（含目标另一行resource，取到resource行后） ===");
console.log(JSON.stringify(src.slice(u - 12, u + 150)));
console.log("\n源首行字节样:" + JSON.stringify(src.slice(u - 12, u + 40)));

// 3. delete 行精确内容
const d = src.indexOf('mom-cover-tool mom-cover-tool-danger" data-act="delete"');
const dStart = src.lastIndexOf("\n", d);
const dLine = src.slice(dStart, d.indexOf("\n", d) + 1);
console.log("\n=== delete 行（含前后换行） ===");
console.log(JSON.stringify(dLine));
console.log("delete 行首字节:" + JSON.stringify(src.slice(dStart, dStart + 40)));