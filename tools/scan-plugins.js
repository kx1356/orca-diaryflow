const fs = require('fs');
const dir = 'C:/Users/i5156/Documents/orca/plugins';
for (const name of fs.readdirSync(dir)) {
  const dist = dir + '/' + name + '/dist/index.js';
  if (!fs.existsSync(dist)) continue;
  const t = fs.readFileSync(dist, 'utf8');
  const kws = ['plugins.writeFile', 'plugins.readFile', 'plugins.listFiles', 'writeFile(', 'readFile(', 'listFiles(', 'upload-asset-binary', 'UploadAssetBinary', 'toDataURL', 'createObjectURL'];
  const hits = kws.filter(k => t.includes(k));
  if (hits.length) console.log(name, '=>', hits.join(', '));
}
