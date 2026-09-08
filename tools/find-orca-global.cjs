// 查找 orca 全局与插件宿主定义
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
    console.log("=== " + kw + " @ " + i + " (total " + total + ") ===");
    console.log(s.slice(Math.max(0, i - span), i + span));
    console.log();
  }
  if (!total) console.log("### " + kw + ": 0 occurrences");
  else console.log("### " + kw + " total: " + total);
}
dump("registerPanel", 500, 4);
dump("setSettingsSchema", 300, 3);
dump("invokeBackend(\"get-plugins\"", 200, 3);
dump("listPlugins", 300, 4);
