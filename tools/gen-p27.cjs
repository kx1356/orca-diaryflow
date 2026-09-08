// 生成 P27 空状态优化补丁（find 精确取自源 bundle 字节）
const fs = require("fs");
const src = fs.readFileSync("E:/Siyuan/One/data/plugins/siyuan-diaryflow/index.js", "utf8");
const base = "C:/Users/i5156/AppData/Roaming/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a866bb5ecf6cdbfe97f12e7/orca-diaryflow/patches/";

// 空状态：还没有动态（find 用字面量 \uXXXX 序列，与 bundle 一致）
const find =
  '<p class="mom-empty-title">\\u8FD8\\u6CA1\\u6709\\u52A8\\u6001</p><p class="mom-empty-sub">\\u8BB0\\u5F55\\u4E0B\\u8FD9\\u4E00\\u523B\\uFF0C\\u8BA9\\u65E5\\u5B50\\u53EF\\u4EE5\\u56DE\\u5934\\u3002</p>';

const rep =
  '<p class="mom-empty-title">\\u8FD8\\u6CA1\\u6709\\u52A8\\u6001</p>' +
  '<p class="mom-empty-sub">\\u8BB0\\u5F55\\u4E0B\\u8FD9\\u4E00\\u523B\\uFF0C\\u8BA9\\u65E5\\u5B50\\u53EF\\u4EE5\\u56DE\\u5934\\u3002</p>' +
  '<p class="mom-empty-hint">\\u53EF\\u4EE5\\u5199\\u6587\\u5B57\\u3001\\u4E0A\\u4F20\\u56FE\\u7247\\uFF0C\\u8FD8\\u80FD\\u52A0\\u4E0A\\u6807\\u7B7E \\u2022 \\u70B9\\u51FB\\u4E0B\\u65B9\\u6309\\u94AE\\u53D1\\u5E03\\u7B2C\\u4E00\\u6761</p>';

console.log("find in source:", src.includes(find));
fs.writeFileSync(base + "P27-empty-hint.find.txt", find);
fs.writeFileSync(base + "P27-empty-hint.replace.txt", rep);
console.log("P27 written. find bytes:", Buffer.byteLength(find, "utf8"));