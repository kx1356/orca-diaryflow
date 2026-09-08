// 读 Journal.db 看 orca-diaryflow 实际持久化了什么
const fs = require("fs");
const os = require("os");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "orcj2-"));
for (const ext of ["", "-wal", "-shm"]) {
  const f = "E:/Ocra/Journal/Journal.db" + ext;
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(tmp, "r.db" + ext));
}
const db = new DatabaseSync(path.join(tmp, "r.db"));
const rows = db.prepare("SELECT name, key, length(value) as vlen FROM PluginStorage WHERE name LIKE '%diaryflow%' OR name LIKE '%moments%'").all();
console.log("orca-diaryflow 相关行:", rows.length);
for (const r of rows) console.log(" ", r.name, "|", r.key, "|", r.vlen + "B");

// 有数据就读全文
if (rows.length) {
  const full = db.prepare("SELECT key, value FROM PluginStorage WHERE name = ?").all("orca-diaryflow");
  for (const f2 of full) {
    const v = f2.value;
    const text = Buffer.isBuffer(v) ? v.toString("utf8") : (v instanceof Uint8Array ? new TextDecoder().decode(v) : String(v));
    console.log("\n=== key:", f2.key, "===");
    try {
      const obj = JSON.parse(text);
      console.log("config:", JSON.stringify(obj.config, null, 2).slice(0, 800));
      console.log("items 数量:", (obj.items || []).length);
      for (const it of (obj.items || []).slice(0, 10)) {
        console.log("  -", it.created, "|", (it.text || "").slice(0, 30), "| 图片:", (it.images || []).length);
      }
    } catch (e) {
      console.log("非 JSON，前300字符:", text.slice(0, 300));
    }
  }
}
