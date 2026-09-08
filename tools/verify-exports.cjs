// 检查各模块的导出
const fs = require("fs");
const path = require("path");
const t = fs.readFileSync(path.join(__dirname, "..", "dist", "index.js"), "utf8");

// __commonJS 定义在 header
const hi = t.indexOf("__commonJS = ");
console.log("__commonJS def @", hi);
if (hi >= 0) console.log(JSON.stringify(t.slice(hi, hi + 200)));

// 找每个模块的 exports 赋值
const marks = ["// src/storage.js", "// src/util.js", "// src/render.js", "// src/export.js", "// src/editor.js"];
for (let i = 0; i < marks.length; i++) {
  const start = t.indexOf(marks[i]);
  const end = i + 1 < marks.length ? t.indexOf(marks[i + 1]) : t.indexOf("// ===== Orca Note entry =====");
  const seg = t.slice(start, end);
  const exps = [...seg.matchAll(/(?:exports2\.|module2\.exports\s*=)([a-zA-Z_$][\w$]*)?/g)].map((m) => m[0]);
  console.log("\n" + marks[i] + " exports:", exps.join(" | "));
  // 最后 150 字符看导出块
  console.log("tail:", JSON.stringify(seg.slice(-180)));
}

// entry 中对这些模块的调用
for (const call of ["storage.defaultData", "storage.loadData", "storage.saveData", "render.renderApp", "editor.register"]) {
  console.log(call, "used:", t.includes(call));
}
