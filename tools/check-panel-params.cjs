const fs = require("fs");
const d = fs.readFileSync("C:/Users/i5156/Documents/orca/plugins/orca-diaryflow/dist/index.js", "utf8");
console.log("addTo(active,\"right\"):", d.includes('addTo(active, "right"'));
const i = d.indexOf("DF_PANEL_W_DEFAULT");
console.log(JSON.stringify(d.slice(i - 20, i + 140)));
const j = d.indexOf("Math.min(0.85, Math.max(0.18");
console.log("宽度范围 0.18~0.85:", j >= 0);
const k = d.indexOf("df-panel-width");
console.log("存储key df-panel-width:", k >= 0);
const m = d.indexOf('addTo(e, "right"');
const n = d.indexOf('addTo(','addTo(active' - 0);
// 找 openPanel 中的锚点
const o = d.indexOf("面板打开");
console.log("注释:", o >= 0 ? JSON.stringify(d.slice(o-40, o+80)) : "n/a");