// mreader 的 React 获取与面板打开逻辑
const fs = require("fs");
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
dump("window.React", 300, 2);
dump("function h(", 300, 1);
dump("async function openAppPanel", 2200, 1);
dump("registerPanel(", 400, 2);
