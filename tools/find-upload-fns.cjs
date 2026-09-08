// 找 uploadAsset / saveImageToAssets / setCover 的实现
const fs = require("fs");
const src = fs.readFileSync("E:/Siyuan/One/data/plugins/siyuan-diaryflow/index.js", "utf8");

for (const fn of ["uploadAsset", "saveImageToAssets", "setCover"]) {
  // 找所有 "function fn" 定义位置
  let i = -1;
  const positions = [];
  while ((i = src.indexOf("function " + fn, i + 1)) >= 0) positions.push(i);
  console.log("### function " + fn + ": " + positions.length + " 处定义");
  for (const p of positions) {
    console.log("=== @ " + p + " ===");
    console.log(src.slice(p, p + 1100));
    console.log();
  }
}
