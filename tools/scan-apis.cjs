// 扫描 orca.d.ts 中所有界面承载相关 API（面板/导航/窗口/视图）
const fs = require("fs");
const t = fs.readFileSync("C:/Users/i5156/Documents/orca/plugins/tag improvement/src/orca.d.ts", "utf8");

function dump(kw, span, limit) {
  let i = -1;
  const ps = [];
  while ((i = t.indexOf(kw, i + 1)) >= 0) ps.push(i);
  console.log("### " + kw + ": " + ps.length + " 处");
  for (const p of ps.slice(0, limit || 4)) {
    console.log("\n=== @" + p + " ===");
    console.log(t.slice(Math.max(0, p - (span >> 1)), p + span));
  }
}
dump("registerPanel", 600, 3);
dump("registerHeadbarButton", 400, 2);
dump("addTo(", 400, 4);
dump("openWindow", 500, 3);
dump("createWindow", 500, 2);
dump("overlay", 300, 3);
dump("registerSidebar", 300, 2);