// 读激活仓库 kungfu 的 db：表结构 + 插件数据/文件
const fs = require("fs");
const os = require("os");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "orcarepo-"));
const src = "C:/Users/i5156/Documents/orca/repos/kungfu";
for (const ext of ["", "-wal", "-shm"]) {
  if (fs.existsSync(src + "/kungfu.db" + ext)) fs.copyFileSync(src + "/kungfu.db" + ext, path.join(tmp, "r.db" + ext));
}
const db = new DatabaseSync(path.join(tmp, "r.db"));
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t) => t.name);
console.log("kungfu.db tables:", tables.join(", "));

for (const t of tables) {
  if (!/plugin|file|data|asset/i.test(t)) continue;
  console.log("\n=== " + t + " ===");
  console.log("cols:", db.prepare("PRAGMA table_info(" + JSON.stringify(t) + ")").all().map((c) => c.name + ":" + c.type).join(", "));
  try {
    const rows = db.prepare("SELECT * FROM " + JSON.stringify(t) + " LIMIT 30").all();
    console.log("rows:", rows.length);
    for (const r of rows) {
      const short = {};
      for (const [k, v] of Object.entries(r)) {
        short[k] = typeof v === "string" ? (v.length > 100 ? v.slice(0, 100) + `...(${v.length}B)` : v) : (v === null ? null : (v instanceof Uint8Array ? `(blob ${v.length}B)` : v));
      }
      console.log(JSON.stringify(short));
    }
  } catch (e) { console.log("err:", e.message); }
}
