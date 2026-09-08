const fs = require('fs');
const path = require('path');
const p = 'C:/Program Files/Orca Note/resources/app.asar';
const fd = fs.openSync(p, 'r');
const hb = Buffer.alloc(16);
fs.readSync(fd, hb, 0, 16, 0);
const size = hb.readUInt32LE(12);
const hb2 = Buffer.alloc(size);
fs.readSync(fd, hb2, 0, size, 16);
const header = JSON.parse(hb2.toString('utf8'));

function find(node, parts) {
  if (!parts.length) return node;
  const next = node.files && node.files[parts[0]];
  if (!next) return null;
  return find(next, parts.slice(1));
}
const base = 16 + size;
function readEntry(entry) {
  const buf = Buffer.alloc(entry.size);
  fs.readSync(fd, buf, 0, entry.size, base + Number(entry.offset));
  return buf;
}

// scan all main jsc files for plugin-related strings
function walk(node, prefix, cb) {
  if (!node.files) return;
  for (const [k, v] of Object.entries(node.files)) {
    const fp = prefix + '/' + k;
    if (v.files) walk(v, fp, cb);
    else cb(fp, v);
  }
}
const targets = [];
walk(header, '', (fp, v) => {
  if (fp.startsWith('/out/main') && (fp.endsWith('.jsc') || fp.endsWith('.js')) && v.size > 5000) targets.push({ fp, v });
});
console.log('main files:', targets.length);
const kws = ['set-plugin-file', 'get-plugin-data', 'plugin-data', 'plugins', 'assets'];
for (const { fp, v } of targets) {
  const buf = readEntry(v);
  const s = buf.toString('latin1');
  let hits = [];
  for (const kw of kws) {
    const i = s.indexOf(kw);
    if (i >= 0) hits.push(kw + '@' + i);
  }
  if (hits.length) console.log(fp, v.size, '=>', hits.join(', '));
}
