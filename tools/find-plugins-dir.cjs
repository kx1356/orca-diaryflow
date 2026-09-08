// 在主进程字节码中查找插件目录解析逻辑
const fs = require("fs");
const p = "C:/Program Files/Orca Note/resources/app.asar";
const fd = fs.openSync(p, "r");
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

// 查找 plugins 目录路径拼接逻辑
function dump(kw, span, limit) {
  let i = -1;
  let n = 0;
  while ((i = s.indexOf(kw, i + 1)) >= 0 && n < (limit || 4)) {
    n++;
    console.log("=== " + kw + " @ " + i + " ===");
    console.log(JSON.stringify(s.slice(Math.max(0, i - span), i + span)));
  }
}
dump("plugin.json", 250, 5);
dump("scan-plugin", 200, 3);
dump('"plugins"', 150, 6);
