// 1. mreader pluginReadJson / pluginWriteJson 实现
// 2. 渲染进程 plugins.setData 实现（SetPluginData）
const fs = require("fs");
const path = require("path");
const m = fs.readFileSync("C:/Users/i5156/Documents/orca/plugins/mreader/dist/index.js", "utf8");

for (const fn of ["function pluginReadJson", "function pluginWriteJson", "function pluginFileExists"]) {
  const i = m.indexOf(fn);
  if (i < 0) { console.log("--- " + fn + " NOT FOUND"); continue; }
  console.log("=== " + fn + " ===");
  console.log(m.slice(i, i + 700));
  console.log();
}

const s = fs.readFileSync(path.join(__dirname, "renderer-main.js"), "utf8");
for (const kw of ["SetPluginData:", "set-plugin-data"]) {
  let i = -1;
  let n = 0;
  while ((i = s.indexOf(kw, i + 1)) >= 0 && n < 3) {
    n++;
    console.log("=== renderer " + kw + " @ " + i + " ===");
    console.log(s.slice(Math.max(0, i - 250), i + 500));
    console.log();
  }
}
// plugins$1 对象上的 setData 方法定义（在 13994078 附近区域搜）
const region = s.slice(13993000, 13997000);
const di = region.indexOf("setData");
if (di >= 0) {
  console.log("=== plugins$1.setData 附近 ===");
  console.log(region.slice(Math.max(0, di - 400), di + 600));
}
