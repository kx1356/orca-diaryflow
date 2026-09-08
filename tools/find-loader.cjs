// 在渲染进程中查找插件脚本加载逻辑
const fs = require("fs");
const path = require("path");
const s = fs.readFileSync(path.join(__dirname, "renderer-main.js"), "utf8");

function dump(kw, span, limit) {
  let i = -1;
  let n = 0;
  const positions = [];
  while ((i = s.indexOf(kw, i + 1)) >= 0) positions.push(i);
  console.log("### " + JSON.stringify(kw) + " occurrences: " + positions.length);
  for (const pos of positions.slice(0, limit || 3)) {
    console.log("=== @ " + pos + " ===");
    console.log(s.slice(Math.max(0, pos - span), pos + span));
    console.log();
  }
}
dump("get-plugin-info", 500, 3);
dump("plugin-file://", 400, 5);
dump("plugin://", 300, 5);
dump("import(", 200, 2);
dump("plugin-entry", 300, 3);
dump("script", 150, 8);
