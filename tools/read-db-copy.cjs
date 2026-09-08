// 复制 db+wal 到临时目录后读取（避免锁）
const fs = require("fs");
const os = require("os");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "orcadb-"));
for (const ext of ["", "-wal", "-shm"]) {
  const src = "C:/Users/i5156/Documents/orca/app.db" + ext;
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(tmp, "app.db" + ext));
}
const db = new DatabaseSync(path.join(tmp, "app.db"));
const rows = db.prepare("SELECT name, enabled, length(schema) as schema_len, settings FROM Plugin ORDER BY name").all();
console.log("Plugin rows:", rows.length);
for (const r of rows) {
  const on = r.enabled ? "[ON] " : "[off] ";
  console.log(on + r.name + "  schema:" + r.schema_len + "  settings:" + String(r.settings || "").slice(0, 80));
}
console.log("\ntmp dir:", tmp);
