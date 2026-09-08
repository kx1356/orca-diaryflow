// 在所有渲染进程文件中查找插件加载逻辑
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
  if (fp.startsWith("/out/renderer") && /\.js$/.test(fp) && v.size > 10000) targets.push({ fp, v });
});
console.log("renderer files:", targets.length);

const kws = ["dist/index.js", "dist", "index.js"];
for (const { fp, v } of targets) {
  const buf = Buffer.alloc(v.size);
  fs.readSync(fd, buf, 0, v.size, base + Number(v.offset));
  const s = buf.toString("utf8");
  if (s.includes("dist/index.js") || s.includes("dist/")) {
    const i = s.indexOf("dist/index.js") >= 0 ? s.indexOf("dist/index.js") : s.indexOf("dist/");
    if (/plugin|orca/i.test(s.slice(Math.max(0, i - 300), i + 300))) {
      console.log("=== " + fp + " (" + v.size + ") ===");
      console.log(s.slice(Math.max(0, i - 400), i + 400));
    }
  }
}
