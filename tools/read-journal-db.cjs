// 读 Journal.db 的 PluginStorage + Plugin 表
const fs = require("fs");
const os = require("os");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "orcj-"));
for (const ext of ["", "-wal", "-shm"]) {
  const f = "E:/Ocra/Journal/Journal.db" + ext;
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(tmp, "r.db" + ext));
}
const db = new DatabaseSync(path.join(tmp, "r.db"));
try {
  const rows = db.prepare("SELECT name, key, length(value) as vlen FROM PluginStorage").all();
  console.log("PluginStorage rows:", rows.length);
  for (const r of rows) console.log("  ", r.name, "|", r.key, "|", r.vlen + "B");
} catch (e) { console.log("PluginStorage err:", e.message); }

try {
  const rows = db.prepare("SELECT name, settings FROM Plugin WHERE name LIKE '%diaryflow%' OR settings LIKE '%moments%'").all();
  console.log("\nPlugin 表 diaryflow/moments 相关:", rows.length);
  for (const r of rows) console.log(JSON.stringify(r).slice(0, 300));
} catch (e) { console.log("Plugin err:", e.message); }
