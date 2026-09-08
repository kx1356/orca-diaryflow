// 1. asar 中的内置插件；2. Documents/orca/plugins 全部文件夹；3. 搜索其他插件目录
const fs = require("fs");
const path = require("path");

// 1. Documents/orca/plugins 全部内容
const pdir = "C:/Users/i5156/Documents/orca/plugins";
console.log("=== Documents/orca/plugins ===");
for (const f of fs.readdirSync(pdir)) {
  console.log(" ", f, fs.statSync(path.join(pdir, f)).isDirectory() ? "[D]" : "[F]");
}

// 2. asar 顶层结构
const asar = "C:/Program Files/Orca Note/resources/app.asar";
const fd = fs.openSync(asar, "r");
const hb = Buffer.alloc(16);
fs.readSync(fd, hb, 0, 16, 0);
const size = hb.readUInt32LE(12);
const hb2 = Buffer.alloc(size);
fs.readSync(fd, hb2, 0, size, 16);
const header = JSON.parse(hb2.toString("utf8"));
console.log("\n=== asar root ===");
for (const k of Object.keys(header.files)) console.log(" ", k, header.files[k].files ? "[D]" : "[F]");

// 3. app.asar.unpacked
const unp = "C:/Program Files/Orca Note/resources/app.asar.unpacked";
if (fs.existsSync(unp)) {
  console.log("\n=== app.asar.unpacked ===");
  for (const f of fs.readdirSync(unp)) console.log(" ", f);
}

// 4. 搜索磁盘上其他 orca plugin 目录（用户目录浅层搜索）
console.log("\n=== 搜索其它插件目录 ===");
const searchRoots = [
  "C:/Users/i5156/Documents",
  "C:/Users/i5156/AppData/Roaming",
];
function findDirs(root, depth) {
  if (depth <= 0) return;
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch (e) { return; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const fp = path.join(root, e.name);
    if (/plugin/i.test(e.name)) console.log("  ", fp);
    findDirs(fp, depth - 1);
  }
}
for (const r of searchRoots) {
  console.log(" under", r);
  findDirs(r, 2);
}
