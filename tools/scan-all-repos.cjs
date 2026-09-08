// 扫描所有仓库 db 的 PluginStorage 表
const fs = require("fs");
const os = require("os");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const repos = ["default", "kungfu", "my-repo", "One", "_doc_10"];
for (const r of repos) {
  const src = "C:/Users/i5156/Documents/orca/repos/" + r;
  const main = path.join(src, r + ".db");
  if (!fs.existsSync(main)) { console.log(r + ": no db"); continue; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "orcar-"));
  for (const ext of ["", "-wal", "-shm"]) {
    const f = path.join(src, r + ".db" + ext);
    if (fs.existsSync(f)) fs.copyFileSync(f, path.join(tmp, "r.db" + ext));
  }
  let db;
  try { db = new DatabaseSync(path.join(tmp, "r.db")); } catch (e) { console.log(r + ": open fail", e.message); continue; }
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t) => t.name);
    if (!tables.includes("PluginStorage")) { console.log(r + ": no PluginStorage table (" + tables.join(",") + ")"); continue; }
    const rows = db.prepare("SELECT name, key, length(value) as vlen FROM PluginStorage").all();
    console.log("\n=== " + r + " PluginStorage: " + rows.length + " rows ===");
    for (const row of rows) {
      console.log("  ", row.name, "|", row.key, "|", row.vlen + "B");
    }
  } catch (e) {
    console.log(r + ": err", e.message);
  }
}
