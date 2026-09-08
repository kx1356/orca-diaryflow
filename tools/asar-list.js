const fs = require('fs');
const p = 'C:/Program Files/Orca Note/resources/app.asar';
const fd = fs.openSync(p, 'r');
const hb = Buffer.alloc(16);
fs.readSync(fd, hb, 0, 16, 0);
const size = hb.readUInt32LE(12);
const hb2 = Buffer.alloc(size);
fs.readSync(fd, hb2, 0, size, 16);
const header = JSON.parse(hb2.toString('utf8'));

const files = [];
function walk(node, prefix) {
  if (!node.files) return;
  for (const [k, v] of Object.entries(node.files)) {
    const path = prefix + '/' + k;
    if (v.files) {
      walk(v, path);
    } else {
      files.push({ path, size: v.size, offset: v.offset });
    }
  }
}
walk(header, '');
for (const f of files) {
  if (f.path.startsWith('/out/')) console.log(f.path, f.size, f.offset);
}
const nm = files.filter(f => f.path.startsWith('/node_modules'));
console.log('--- node_modules files:', nm.length);
