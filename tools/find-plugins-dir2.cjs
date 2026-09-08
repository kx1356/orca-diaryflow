// 在渲染进程源码中查找插件发现/加载逻辑
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname);
// renderer-index.js 是之前提取的渲染进程文件
const files = ["renderer-index.js"].filter((f) => fs.existsSync(path.join(dir, f)));
for (const f of files) {
  const s = fs.readFileSync(path.join(dir, f), "utf8");
  console.log("file:", f, "size:", s.length);
  function dump(kw, span, limit) {
    let i = -1;
    let n = 0;
    while ((i = s.indexOf(kw, i + 1)) >= 0 && n < (limit || 4)) {
      n++;
      console.log("=== " + kw + " @ " + i + " ===");
      console.log(s.slice(Math.max(0, i - span), i + span).replace(/\n/g, "\\n"));
    }
    if (!n) console.log("--- " + kw + " not found");
  }
  dump("plugin.json", 300, 5);
  dump("scanPlugins", 300, 3);
  dump("loadPlugin", 300, 3);
  dump("get-plugins", 300, 3);
  dump("read-plugin-dir", 300, 3);
}
