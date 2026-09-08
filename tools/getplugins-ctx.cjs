// dump get-plugins 实现上下文与插件目录解析
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

function dump(kw, span, limit) {
  let i = -1;
  let n = 0;
  while ((i = s.indexOf(kw, i + 1)) >= 0 && n < (limit || 3)) {
    n++;
    console.log("=== " + JSON.stringify(kw) + " @ " + i + " ===");
    console.log(JSON.stringify(s.slice(Math.max(0, i - span), i + span)));
  }
  if (!n) console.log("--- " + JSON.stringify(kw) + " not found");
}
dump("get-plugins", 400, 4);
dump("get-plugin-info", 300, 2);
// 查找 "plugins" 目录路径的拼接（典型：join(x, "plugins")）
let idx = -1;
let count = 0;
while ((idx = s.indexOf("plugins", idx + 1)) >= 0 && count < 40) {
  const ctx = s.slice(Math.max(0, idx - 80), idx + 100);
  // 只显示看起来像路径拼接的（附近有 join 或 / 或 \\）
  if (/join|documents|userData|appData|getPath/i.test(ctx) || ctx.indexOf(String.fromCharCode(92)) >= 0) {
    count++;
    console.log("=== pathctx @ " + idx + " ===");
    console.log(JSON.stringify(ctx));
  }
}
