// 在 main.jsc 中找 get-plugin-file 后端处理逻辑（搜 assets/plugins 路径拼接）
const fs = require("fs");
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

// 搜路径拼接相关字符串
for (const kw of ["assets/plugins", "assets\\\\plugins", "plugins/", "readFile", "readFileSync", "base64"]) {
  let i = -1;
  let n = 0;
  const total = (s.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
  console.log("### " + JSON.stringify(kw) + " 出现 " + total + " 次");
}

// assets 字符串上下文
console.log("\n=== assets 上下文 ===");
let i = -1;
let n = 0;
while ((i = s.indexOf("assets", i + 1)) >= 0 && n < 20) {
  const ctx = s.slice(Math.max(0, i - 100), i + 120);
  if (/plugin|join|dir/i.test(ctx)) {
    n++;
    console.log("@ " + i + ":", JSON.stringify(ctx));
  }
}
