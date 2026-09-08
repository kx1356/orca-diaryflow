// 1. 渲染进程 plugins$1.setData 实现  2. mreader 插件文件区 JSON 读写
const fs = require("fs");
const path = require("path");
const s = fs.readFileSync(path.join(__dirname, "renderer-main.js"), "utf8");

// plugins$1 的 setData/getData 实现
for (const kw of ["setData(name", "async setData", "setData(e,", "get-plugin-data"]) {
  let i = -1;
  let n = 0;
  while ((i = s.indexOf(kw, i + 1)) >= 0 && n < 3) {
    n++;
    console.log("=== renderer: " + kw + " @ " + i + " ===");
    console.log(s.slice(Math.max(0, i - 300), i + 400));
    console.log();
  }
}

// mreader 的文件区读写（'bookshelf.json' 前后）
const m = fs.readFileSync("C:/Users/i5156/Documents/orca/plugins/mreader/dist/index.js", "utf8");
const bi = m.indexOf("bookshelf.json', null");
if (bi >= 0) {
  console.log("=== mreader 文件区读取上下文 ===");
  console.log(m.slice(Math.max(0, bi - 1200), bi + 200));
}
// 写入侧
for (const kw of ["set-plugin-file", "write-plugin-file", "setPluginFile"]) {
  let i = -1;
  while ((i = m.indexOf(kw, i + 1)) >= 0) {
    console.log("=== mreader " + kw + " @ " + i + " ===");
    console.log(m.slice(Math.max(0, i - 350), i + 350));
    console.log();
  }
}
