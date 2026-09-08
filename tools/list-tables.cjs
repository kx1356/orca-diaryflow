// 列出 app.db 所有表 + Plugin 相关表的 schema 和内容
const fs = require("fs");
const os = require("os");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "orcadb3-"));
for (const ext of ["", "-wal", "-shm"]) {
  const s = "C:/Users/i5156/Documents/orca/app.db" + ext;
  if (fs.existsSync(s)) fs.copyFileSync(s, path.join(tmp, "app.db" + ext));
}
const db = new DatabaseSync(path.join(tmp, "app.db"));
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t) => t.name);
console.log("tables:", tables.join(", "));

for (const t of tables) {
  if (!/plugin/i.test(t)) continue;
  console.log("\n=== " + t + " ===");
  const cols = db.prepare("PRAGMA table_info(" + t + ")").all().map((c) => c.name + " " + c.type);
  console.log("cols:", cols.join(", "));
  try {
    const rows = db.prepare("SELECT * FROM " + t + " LIMIT 20").all();
    console.log("rows:", rows.length);
    for (const r of rows) {
      const ks = Object.keys(r);
      const short = {};
      for (const k of ks) {
        const v = r[k];
        short[k] = typeof v === "string" ? (v.length > 80 ? v.slice(0, 80) + `...(${v.length}B)` : v) : v;
      }
      console.log(JSON.stringify(short));
    }
  } catch (e) {
    console.log("read err:", e.message);
  }
}
