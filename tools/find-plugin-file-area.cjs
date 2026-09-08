// 找插件文件区真实位置：搜 set-plugin-file 后端实现 + 扫描磁盘
const fs = require("fs");
const path = require("path");

// 1. 主进程 set-plugin-file 实现上下文
const asar = "C:/Program Files/Orca Note/resources/app.asar";
const fd = fs.openSync(asar, "r");
const hb = Buffer.alloc(16);
fs.readSync(fd, hb, 0, 16, 0);
const size = hb.readUInt32LE(12);
const hb2 = Buffer.alloc(size);
fs.readSync(fd, hb2, 0, size, 16);
const header = JSON.parse(hb2.toString("utf8"));
const base = 16 + size;
function find(node, parts) {
  if (!parts.length) return node;
  const next = node.files && node.files[parts[0]];
  if (!next) return null;
  return find(next, parts.slice(1));
}
const entry = find(header, ["out", "main", "main.jsc"]);
const buf = Buffer.alloc(entry.size);
fs.readSync(fd, buf, 0, entry.size, base + Number(entry.offset));
const s = buf.toString("latin1");
let i = -1;
while ((i = s.indexOf("set-plugin-file", i + 1)) >= 0) {
  console.log("=== set-plugin-file @ " + i + " ===");
  console.log(JSON.stringify(s.slice(Math.max(0, i - 300), i + 300)));
  console.log();
}

// 2. 磁盘上找 plugins 文件区（含 diaryflow 文件的目录）
console.log("=== 磁盘搜索 ===");
const roots = ["C:/Users/i5156/Documents/orca", "C:/Users/i5156/AppData/Roaming/OrcaNote"];
function findDir(root, depth) {
  if (depth <= 0) return;
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch (e) { return; }
  for (const e of entries) {
    if (!e.isDirectory() || e.name === "node_modules" || e.name.startsWith(".")) continue;
    const fp = path.join(root, e.name);
    if (/plugin/i.test(e.name)) console.log("  ", fp);
    findDir(fp, depth - 1);
  }
}
for (const r of roots) { console.log("under", r); findDir(r, 3); }

// 3. 直接搜含 "orca-diaryflow" 子目录的位置
console.log("=== 直接搜 orca-diaryflow 目录 ===");
const cand = [
  "C:/Users/i5156/Documents/orca/assets/plugins",
  "C:/Users/i5156/Documents/orca/data/plugins",
  "C:/Users/i5156/AppData/Roaming/OrcaNote/plugins",
];
for (const c of cand) {
  if (fs.existsSync(c)) {
    console.log(c, "=>", fs.readdirSync(c).join(", "));
  } else {
    console.log(c, "(不存在)");
  }
}
// 4. Documents/orca 顶层
console.log("=== Documents/orca 顶层 ===");
for (const f of fs.readdirSync("C:/Users/i5156/Documents/orca")) {
  console.log(" ", f, fs.statSync(path.join("C:/Users/i5156/Documents/orca", f)).isDirectory() ? "[D]" : "[F]");
}
