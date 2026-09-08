// 验证 dist/index.js 中模块封装与 orca-entry 的调用是否匹配
const fs = require("fs");
const path = require("path");
const t = fs.readFileSync(path.join(__dirname, "..", "dist", "index.js"), "utf8");

console.log("has __commonJS:", t.includes("__commonJS"));
console.log("require_storage defined:", /var require_storage\s*=/.test(t));
console.log("require_render defined:", /var require_render\s*=/.test(t));
console.log("require_editor defined:", /var require_editor\s*=/.test(t));
console.log("require_export defined:", /var require_export\s*=/.test(t));
console.log("require_util defined:", /var require_util\s*=/.test(t));

// 各模块标记后 200 字符，看封装方式
for (const m of ["// src/storage.js", "// src/util.js", "// src/render.js", "// src/export.js", "// src/editor.js"]) {
  const i = t.indexOf(m);
  console.log("\n=== " + m + " @ " + i + " ===");
  console.log(JSON.stringify(t.slice(i, i + 250)));
}

// storage 模块导出了什么
const si = t.indexOf("module.exports", t.indexOf("// src/storage.js"));
console.log("\nstorage module.exports @", si);
if (si >= 0) console.log(JSON.stringify(t.slice(si - 100, si + 200)));

// entry 调用处
const ei = t.indexOf("var storage = require_storage()");
console.log("\nentry call:", JSON.stringify(t.slice(ei - 50, ei + 150)));
