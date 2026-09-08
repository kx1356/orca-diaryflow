// 检查 Plugin 表 settings 字段中的实际数据 + storage 模块用的 key
const fs = require("fs");
const os = require("os");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

// 1. storage 模块用什么 key
const src = fs.readFileSync("E:/Siyuan/One/data/plugins/siyuan-diaryflow/index.js", "utf8");
const sStart = src.indexOf("// src/storage.js");
const sEnd = src.indexOf("// src/util.js");
const seg = src.slice(sStart, sEnd);
const keys = [...seg.matchAll(/loadData\("([^"]+)"\)|saveData\("([^"]+)"/g)].map((m) => m[1] || m[2]);
console.log("storage 使用的 key:", [...new Set(keys)]);

// 2. db 中该插件 settings 实际内容
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "orcadb2-"));
for (const ext of ["", "-wal", "-shm"]) {
  const s = "C:/Users/i5156/Documents/orca/app.db" + ext;
  if (fs.existsSync(s)) fs.copyFileSync(s, path.join(tmp, "app.db" + ext));
}
const db = new DatabaseSync(path.join(tmp, "app.db"));
const rows = db.prepare("SELECT name, enabled, settings FROM Plugin WHERE name = ?").all("orca-diaryflow");
for (const r of rows) {
  console.log("\nname:", r.name, "enabled:", r.enabled);
  console.log("settings 原文 (前2000字符):");
  console.log(String(r.settings || "").slice(0, 2000));
  console.log("settings 总长:", String(r.settings || "").length);
}
// 3. 其他插件的 settings 格式参考
const others = db.prepare("SELECT name, settings FROM Plugin WHERE settings IS NOT NULL AND settings != '' AND name != 'orca-diaryflow' LIMIT 3").all();
for (const o of others) {
  console.log("\n--- 参考", o.name, "---");
  console.log(String(o.settings).slice(0, 300));
}
