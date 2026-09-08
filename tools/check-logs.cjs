// 查找 Orca Note 日志文件 + 解析 WAL 中 Plugin 表的写入
const fs = require("fs");
const path = require("path");

// 1. 常见日志位置
const candidates = [
  "C:/Users/i5156/AppData/Roaming/OrcaNote/logs",
  "C:/Users/i5156/AppData/Roaming/OrcaNote",
  "C:/Users/i5156/AppData/Local/Orca Note",
  "C:/Users/i5156/Documents/orca",
  "C:/Users/i5156/AppData/Roaming/OrcaNote/log",
];
for (const d of candidates) {
  if (fs.existsSync(d)) {
    const files = fs.readdirSync(d).filter((f) => /\.log$|log/i.test(f));
    console.log(d, "=>", files.slice(0, 20).join(", ") || "(no log files)");
  }
}

// 2. WAL 中 orca-diaryflow 相关帧
const wal = fs.readFileSync("C:/Users/i5156/Documents/orca/app.db-wal");
const s = wal.toString("latin1");
console.log("\nWAL size:", wal.length);
for (const kw of ["orca-diaryflow", "orca-diaryflow", "diaryflow"]) {
  let i = -1;
  let n = 0;
  while ((i = s.indexOf(kw, i + 1)) >= 0 && n < 5) {
    n++;
    console.log("=== WAL " + kw + " @ " + i + " ===");
    console.log(JSON.stringify(s.slice(Math.max(0, i - 150), i + 200)));
  }
  if (!n) console.log("--- WAL no " + kw);
}
