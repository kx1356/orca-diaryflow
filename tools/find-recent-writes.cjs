// 搜索最近 2 天修改的文件（找 set-plugin-file 的真实写入位置）
const fs = require("fs");
const path = require("path");
const cutoff = Date.now() - 2 * 24 * 3600 * 1000;
const found = [];
function scan(root, depth) {
  if (depth <= 0) return;
  let es;
  try { es = fs.readdirSync(root, { withFileTypes: true }); } catch (e) { return; }
  for (const e of es) {
    const fp = path.join(root, e.name);
    let st;
    try { st = fs.statSync(fp); } catch (err) { continue; }
    if (e.isDirectory()) {
      if (["node_modules", ".git", "Cache", "Code Cache", "GPUCache", "cache", "__pycache__"].includes(e.name) || e.name.startsWith(".")) continue;
      scan(fp, depth - 1);
    } else {
      if (st.mtimeMs >= cutoff) {
        // 排除我们自己的项目目录和已知目录
        if (fp.includes("TRAE SOLO CN") || fp.includes("\\orca\\plugins\\") || fp.includes("/orca/plugins/")) continue;
        if (/\.(log|tmp|lock)$/i.test(e.name)) continue;
        found.push({ fp, mtime: st.mtime, size: st.size });
      }
    }
  }
}
scan("C:/Users/i5156/Documents", 5);
scan("C:/Users/i5156/AppData/Roaming", 4);
found.sort((a, b) => b.mtime - a.mtime);
console.log("最近 2 天修改的文件（排除插件安装目录）:", found.length);
for (const f of found.slice(0, 40)) {
  console.log(f.mtime.toLocaleString("zh-CN"), (f.size + "B").padStart(9), f.fp);
}
