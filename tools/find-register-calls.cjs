// 查找启动时插件注册调用和设置界面插件列表
const fs = require("fs");
const path = require("path");
const s = fs.readFileSync(path.join(__dirname, "renderer-main.js"), "utf8");

function dump(kw, span, limit) {
  let i = -1;
  let n = 0;
  let total = 0;
  while ((i = s.indexOf(kw, i + 1)) >= 0) {
    total++;
    if (n >= (limit || 3)) continue;
    n++;
    console.log("=== " + kw + " @ " + i + " ===");
    console.log(s.slice(Math.max(0, i - span), i + span));
    console.log();
  }
  console.log("### " + kw + " total: " + total);
}
// APIMsgs.GetPlugins 的使用处（非枚举定义）
dump("APIMsgs.GetPlugins", 400, 5);
// plugins$1 遍历渲染设置 UI
dump("Object.values(plugins$1)", 500, 5);
dump("Object.keys(plugins$1)", 400, 5);
