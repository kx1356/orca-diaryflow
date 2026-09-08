// 用 UTF-16LE 模式搜索 main.jsc 中的 plugin.json
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

function utf16le(str) {
  return Buffer.from(str, "utf16le");
}
for (const kw of ["plugin.json", "package.json", "minAppVersion"]) {
  const needle = utf16le(kw);
  const i = buf.indexOf(needle);
  console.log(kw, "utf16:", i >= 0 ? "FOUND @" + i : "not found");
  if (i >= 0) {
    console.log(JSON.stringify(buf.slice(Math.max(0, i - 200), i + 300).toString("latin1")));
  }
}
// 也搜 main 目录其它 chunk
function walk(node, prefix, cb) {
  if (!node.files) return;
  for (const [k, v] of Object.entries(node.files)) {
    const fp = prefix + "/" + k;
    if (v.files) walk(v, fp, cb);
    else cb(fp, v);
  }
}
walk(header, "", (fp, v) => {
  if (!fp.startsWith("/out/main") || !/\.jsc$/.test(fp)) return;
  const b = Buffer.alloc(v.size);
  fs.readSync(fd, b, 0, v.size, base + Number(v.offset));
  for (const kw of ["plugin.json", "package.json"]) {
    if (b.indexOf(utf16le(kw)) >= 0 || b.indexOf(Buffer.from(kw)) >= 0) {
      console.log(fp, "contains", kw);
    }
  }
});
