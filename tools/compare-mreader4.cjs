// mreader openAppPanel 开头部分
const fs = require("fs");
const t = fs.readFileSync("C:/Users/i5156/Documents/orca/plugins/mreader/dist/index.js", "utf8");
const i = t.indexOf("async function openAppPanel");
console.log("openAppPanel @", i);
console.log(t.slice(i, i + 2400));
