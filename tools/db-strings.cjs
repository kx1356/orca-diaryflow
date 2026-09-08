// 检查 app.db 中的插件注册信息（字符串方式，无 sqlite 依赖）
const fs = require("fs");
const p = "C:/Users/i5156/Documents/orca/app.db";
const buf = fs.readFileSync(p);
const s = buf.toString("latin1");

// 找已知插件名的上下文
for (const kw of ["mreader", "weeky", "orca-diaryflow", "MReader"]) {
  let i = -1;
  let n = 0;
  while ((i = s.indexOf(kw, i + 1)) >= 0 && n < 5) {
    n++;
    console.log("=== " + kw + " @ " + i + " ===");
    console.log(JSON.stringify(s.slice(Math.max(0, i - 120), i + 180)));
  }
  if (!n) console.log("--- " + kw + ": not found");
}

// 找表结构关键词
console.log("\n=== table-ish strings ===");
for (const kw of ["CREATE TABLE", "plugin", "enabled_plugins"]) {
  let i = -1;
  let n = 0;
  while ((i = s.toLowerCase().indexOf(kw.toLowerCase(), i + 1)) >= 0 && n < 8) {
    n++;
    const ctx = s.slice(Math.max(0, i - 60), i + 120);
    if (ctx.includes("table") || kw === "enabled_plugins") {
      console.log(JSON.stringify(ctx));
    }
  }
}
