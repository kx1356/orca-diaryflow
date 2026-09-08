// 在 asar 所有 out/ 文件中查找 get-plugins 实现
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

function walk(node, prefix, cb) {
  if (!node.files) return;
  for (const [k, v] of Object.entries(node.files)) {
    const fp = prefix + "/" + k;
    if (v.files) walk(v, fp, cb);
    else cb(fp, v);
  }
}

const targets = [];
walk(header, "", (fp, v) => {
  if (fp.startsWith("/out/") && /\.(jsc|js)$/.test(fp) && v.size > 1000) targets.push({ fp, v });
});
console.log("files to scan:", targets.length);

const kws = ["get-plugins", "plugin.json", "plugins"];
for (const { fp, v } of targets) {
  const buf = Buffer.alloc(v.size);
  fs.readSync(fd, buf, 0, v.size, base + Number(v.offset));
  const s = buf.toString("latin1");
  const hits = kws.filter((k) => s.includes(k));
  if (hits.length) console.log(fp, v.size, "=>", hits.join(","));
}
