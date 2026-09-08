// 读 App 表全部内容 + 扫 AppData/Local 找 orca 相关目录
const fs = require("fs");
const os = require("os");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "orcadb4-"));
for (const ext of ["", "-wal", "-shm"]) {
  const s = "C:/Users/i5156/Documents/orca/app.db" + ext;
  if (fs.existsSync(s)) fs.copyFileSync(s, path.join(tmp, "app.db" + ext));
}
const db = new DatabaseSync(path.join(tmp, "app.db"));
console.log("=== App 表 ===");
console.log("cols:", db.prepare("PRAGMA table_info(App)").all().map((c) => c.name + ":" + c.type).join(", "));
const rows = db.prepare("SELECT * FROM App").all();
console.log("rows:", rows.length);
for (const r of rows) {
  const ks = Object.keys(r);
  for (const k of ks) {
    const v = r[k];
    if (typeof v === "string" && v.length > 200) {
      console.log("row key=" + k + " len=" + v.length);
      console.log("  head:", v.slice(0, 300));
      if (v.includes("diaryflow") || v.includes("moments")) {
        console.log("  >>> 含 diaryflow/moments <<<");
        let i = v.indexOf("diaryflow");
        if (i < 0) i = v.indexOf("moments");
        console.log("  ctx:", v.slice(Math.max(0, i - 100), i + 300));
      }
    } else {
      console.log(k, "=", v);
    }
  }
}

// AppData/Local 下 orca 相关
console.log("\n=== AppData/Local orca 相关 ===");
for (const root of ["C:/Users/i5156/AppData/Local"]) {
  for (const e of fs.readdirSync(root)) {
    if (/orca/i.test(e)) console.log(path.join(root, e));
  }
}
