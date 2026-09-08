const fs = require("fs");
const t = fs.readFileSync("E:/Siyuan/One/data/plugins/siyuan-diaryflow/index.js", "utf8");
const u = t.indexOf('data-act="upload"');
const d = t.indexOf('data-act="delete"');
console.log("upload:", JSON.stringify(t.slice(t.lastIndexOf("\n", u), u + 350)));
console.log("delete:", JSON.stringify(t.slice(t.lastIndexOf("\n", d), d + 350)));
console.log("upload unique:", (t.match(/data-act="upload"/g) || []).length);
console.log("delete unique:", (t.match(/mom-cover-tool.*data-act="delete"/g) || []).length);