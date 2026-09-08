// 精确提取 mreader 的 headbar 注册 / React 获取 / 面板打开代码
const fs = require("fs");
const path = require("path");
const t = fs.readFileSync("C:/Users/i5156/Documents/orca/plugins/mreader/dist/index.js", "utf8");

function dump(kw, span, limit) {
  let i = -1;
  let n = 0;
  while ((i = t.indexOf(kw, i + 1)) >= 0 && n < (limit || 1)) {
    n++;
    console.log("=== " + kw + " @ " + i + " ===");
    console.log(t.slice(Math.max(0, i - span), i + span));
    console.log();
  }
  if (!n) console.log("--- " + kw + " NOT FOUND");
}
dump("registerHeadbarButton", 900, 2);
dump("window.React", 250, 3);
dump("headbarButtons", 400, 4);
dump("components.Button", 400, 3);
dump("openAppPanel", 1800, 1);
