// mreader 的 pluginFileBytes / pluginWriteBytes 完整实现（已验证可用的模式）
const fs = require("fs");
const m = fs.readFileSync("C:/Users/i5156/Documents/orca/plugins/mreader/dist/index.js", "utf8");

for (const fn of ["function pluginFileBytes", "function pluginWriteBytes", "function arrayBufferToBase64"]) {
  const i = m.indexOf(fn);
  if (i < 0) { console.log("--- " + fn + " NOT FOUND"); continue; }
  console.log("=== " + fn + " ===");
  console.log(m.slice(i, i + 800));
  console.log();
}
// get-plugin-file 的调用签名
let j = -1;
while ((j = m.indexOf("get-plugin-file", j + 1)) >= 0) {
  console.log("=== get-plugin-file @ " + j + " ===");
  console.log(m.slice(Math.max(0, j - 250), j + 250));
  console.log();
}
