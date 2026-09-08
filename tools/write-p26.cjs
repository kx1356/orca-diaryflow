// 用 Node 精确写入 P26 find/replace（前导换行 + 字面量 \u 序列）
const fs = require("fs");
const base = "C:/Users/i5156/AppData/Roaming/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a866bb5ecf6cdbfe97f12e7/orca-diaryflow/patches/";

// 字面量 \uXXXX 序列（源 bundle 中的形式）
const find = "\n" +
  '            <button class="mom-cover-tool mom-cover-tool-danger" data-act="delete" title="\\u5220\\u9664\\u5E76\\u6062\\u590D\\u9ED8\\u8BA4">${ico("trash")}<span>\\u5220\\u9664</span></button>';

fs.writeFileSync(base + "P26-rmdelete.find.txt", find);
fs.writeFileSync(base + "P26-rmdelete.replace.txt", "");
console.log("P26 find written, bytes:", Buffer.byteLength(find, "utf8"), "startsNl:", find.startsWith("\n"));

// 校验可匹配源文件
const src = fs.readFileSync("E:/Siyuan/One/data/plugins/siyuan-diaryflow/index.js", "utf8");
console.log("find in source:", src.includes(find));

// 同样校验 P25 find
const p25 = fs.readFileSync(base + "P25-rmupload.find.txt", "utf8");
console.log("P25 find bytes:", Buffer.byteLength(p25, "utf8"), "in source:", src.includes(p25));