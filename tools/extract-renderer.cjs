// 提取渲染进程 index-r11E17oU.js 并分析插件列表逻辑
const fs = require("fs");
const path = require("path");
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
const entry = find(header, ["out", "renderer", "assets", "index-r11E17oU.js"]);
const buf = Buffer.alloc(entry.size);
fs.readSync(fd, buf, 0, entry.size, base + Number(entry.offset));
const outPath = path.join(__dirname, "renderer-main.js");
fs.writeFileSync(outPath, buf);
console.log("extracted", entry.size, "->", outPath);

const s = buf.toString("utf8");
function dump(kw, span, limit) {
  let i = -1;
  let n = 0;
  while ((i = s.indexOf(kw, i + 1)) >= 0 && n < (limit || 3)) {
    n++;
    console.log("=== " + kw + " @ " + i + " ===");
    console.log(s.slice(Math.max(0, i - span), i + span));
  }
  if (!n) console.log("--- " + kw + " not found");
}
dump("get-plugins", 600, 4);
dump("loadPlugin", 400, 6);
dump("plugin.json", 300, 6);
