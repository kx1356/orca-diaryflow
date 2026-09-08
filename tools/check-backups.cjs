// 检查 db 备份中 orca-diaryflow 行的存在时间
const fs = require("fs");
const path = require("path");
const dir = "C:/Users/i5156/Documents/orca";
const { DatabaseSync } = require("node:sqlite");

const backups = fs.readdirSync(dir).filter((f) => /^app-\d+\.db$/.test(f)).sort();
console.log("backups:", backups.join(", "));

for (const f of backups) {
  try {
    const db = new DatabaseSync(path.join(dir, f), { readOnly: true });
    const rows = db.prepare("SELECT name, enabled FROM Plugin WHERE name LIKE '%diaryflow%' OR name LIKE '%diary%'").all();
    console.log(f, "=>", JSON.stringify(rows));
    db.close();
  } catch (e) {
    console.log(f, "error:", e.message);
  }
}

// 也检查 WAL 中的 orca-diaryflow（近期写入）
const wal = path.join(dir, "app.db-wal");
if (fs.existsSync(wal)) {
  const st = fs.statSync(wal);
  const buf = fs.readFileSync(wal);
  const idx = buf.indexOf(Buffer.from("orca-diaryflow"));
  console.log("\nWAL size:", st.size, "mtime:", st.mtime.toISOString());
  console.log("WAL contains orca-diaryflow:", idx >= 0 ? "YES @" + idx : "no");
}
// db 主文件 mtime
const st2 = fs.statSync(path.join(dir, "app.db"));
console.log("app.db mtime:", st2.mtime.toISOString());
