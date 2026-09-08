// 找 open-outline 的处理逻辑
const fs = require("fs");
const t = fs.readFileSync("E:/Siyuan/One/data/plugins/siyuan-diaryflow/index.js", "utf8");
let j = -1;
const ps = [];
while ((j = t.indexOf("open-outline", j + 1)) >= 0) ps.push(j);
console.log("open-outline 出现:", ps.join(", "));
for (const p of ps) {
  console.log("\n=== @" + p + " ===");
  console.log(t.slice(Math.max(0, p - 300), p + 500));
}
// 找 outline 模态/渲染函数
for (const k of ["outline", "大纲"]) {
  let i = -1;
  const qs = [];
  while (qs.length < 8 && (i = t.indexOf(k, i + 1)) >= 0) qs.push(i);
  console.log("\n### " + k + " 关键位置:", qs.join(", "));
}