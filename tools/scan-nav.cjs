// 提取 nav 完整定义（goTo 附近 + 后续方法），并找 openView/window/overlay/modal 相关
const fs = require("fs");
const t = fs.readFileSync("C:/Users/i5156/Documents/orca/plugins/tag improvement/src/orca.d.ts", "utf8");
const navi = t.indexOf("nav: {");
const nav = t.slice(navi, navi + 4200);
console.log("=== nav 定义（4200 字符） ===");
console.log(nav);
console.log("\n\n=== 找 window/modal/overlay/view 注册类 API ===");
for (const kw of ["registerView", "openView", "registerWindow", "modal", "Modal", "createOverlay", "fullscreen", "Fullscreen", "registerTab", "registerPage"]) {
  const ps = [];
  let i = -1;
  while ((i = t.indexOf(kw, i + 1)) >= 0) ps.push(i);
  if (ps.length) console.log(kw + ":", ps.slice(0, 6).join(", "));
}