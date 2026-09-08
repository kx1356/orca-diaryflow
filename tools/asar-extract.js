const fs = require('fs');
const path = require('path');
// usage: node asar-extract.js <innerPath> <outFile>
const inner = process.argv[2];
const outFile = process.argv[3];
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
const parts = inner.split('/').filter(Boolean);
const entry = find(header, parts);
if (!entry || !('offset' in entry)) {
  console.error('not found or is dir:', inner);
  process.exit(1);
}
const base = 16 + size;
const start = base + Number(entry.offset);
const buf = Buffer.alloc(entry.size);
fs.readSync(fd, buf, 0, entry.size, start);
fs.writeFileSync(outFile, buf);
console.log('extracted', entry.size, 'bytes ->', outFile);
