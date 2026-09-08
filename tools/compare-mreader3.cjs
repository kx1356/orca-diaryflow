// mreader openAppPanel 完整实现 + registerPanel 用法
const fs = require("fs");
const t = fs.readFileSync("C:/Users/i5156/Documents/orca/plugins/mreader/dist/index.js", "utf8");

// openAppPanel 从 44574 开始，输出 44700 往后 2500 字符
console.log("=== openAppPanel body ===");
console.log(t.slice(45000, 47600));
console.log("\n=== registerPanel usage ===");
let i = -1;
while ((i = t.indexOf("registerPanel(", i + 1)) >= 0) {
  console.log("--- @ " + i);
  console.log(t.slice(i - 300, i + 500));
}
