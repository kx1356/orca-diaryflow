// 在 main.jsc 及所有 main chunks 中查找插件元数据字段
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
function walk(node, prefix, cb) {
  if (!node.files) return;
  for (const [k, v] of Object.entries(node.files)) {
    const fp = prefix + "/" + k;
    if (v.files) walk(v, fp, cb);
    else cb(fp, v);
  }
}

const kws = ["minAppVersion", "displayName", "plugin-icon", "plugin-icon.", "/plugins", "plugins/", "plugin-data", "get-plugins"];
walk(header, "", (fp, v) => {
  if (!fp.startsWith("/out/main") || !/\.(jsc|js)$/.test(fp)) return;
  const buf = Buffer.alloc(v.size);
  fs.readSync(fd, buf, 0, v.size, base + Number(v.offset));
  const s = buf.toString("latin1");
  for (const kw of kws) {
    let i = -1;
    let n = 0;
    while ((i = s.indexOf(kw, i + 1)) >= 0 && n < 3) {
      n++;
      console.log("=== " + fp + " | " + kw + " @ " + i + " ===");
      console.log(JSON.stringify(s.slice(Math.max(0, i - 200), i + 250)));
    }
  }
});
