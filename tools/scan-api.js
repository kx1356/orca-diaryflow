const fs = require('fs');
const t = fs.readFileSync('C:/Users/i5156/AppData/Roaming/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a866bb5ecf6cdbfe97f12e7/orca-diaryflow/tools/renderer-index.js', 'utf8');
const kws = ['UploadAssetBinary', 'UploadAssets', 'GetPluginFile', 'SetPluginFile', 'ListPluginFiles', 'GetPluginData', 'SetPluginData', 'PluginFileExists', 'RemovePluginFile'];
for (const kw of kws) {
  // find enum-style:  kw:"value" or kw="value" or kw: "value"
  const re = new RegExp(kw + '\\s*[:=]\\s*["\']([^"\']+)["\']');
  const m = re.exec(t);
  console.log(kw, '->', m ? m[1] : '(not found as enum)');
}
// also find APIMsgs object definition
const i = t.indexOf('APIMsgs=');
if (i >= 0) console.log('APIMsgs def @', i, t.slice(i, i + 600).replace(/\n/g, ' '));
const j = t.indexOf('var APIMsgs');
if (j >= 0) console.log('var APIMsgs @', j, t.slice(j, j + 600).replace(/\n/g, ' '));
