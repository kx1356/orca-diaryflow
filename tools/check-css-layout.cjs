// 查源码 CSS 里 mom-publish-info 相关样式
const fs = require("fs");
const src = fs.readFileSync("E:/Siyuan/One/data/plugins/siyuan-diaryflow/index.css", "utf8");

console.log("=== mom-publish-info 区域 ===");
const i = src.indexOf(".mom-publish-info");
console.log(src.slice(Math.max(0, i - 200), i + 800));

console.log("\n=== mom-publish-inp 区域 ===");
const j = src.indexOf(".mom-publish-inp");
let pos = j;
let n = 0;
while (pos >= 0 && n < 4) {
  console.log("@ " + pos + ":");
  console.log(src.slice(pos, pos + 300));
  console.log();
  pos = src.indexOf(".mom-publish-inp", pos + 1);
  n++;
}

console.log("\n=== mom-publish 整体结构 ===");
console.log("CSS 总长:", src.length);
console.log("mom-publish-card:", src.indexOf(".mom-publish-card"));
console.log("mom-publish-content:", src.indexOf(".mom-publish-content"));