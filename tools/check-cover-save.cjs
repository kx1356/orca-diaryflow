// 查 editor 模块 uploadCover / 头像上传的完整实现，确认保存链路
const fs = require("fs");
const src = fs.readFileSync("E:/Siyuan/One/data/plugins/siyuan-diaryflow/index.js", "utf8");
const eStart = src.indexOf("// src/editor.js");
const iStart = src.indexOf("// src/index.js");
const editor = src.slice(eStart, iStart);

for (const fn of ["uploadCover", "deleteCover", "pickCoverFile", "uploadAvatar", "setAvatar", "changeAvatar"]) {
  let i = editor.indexOf("function " + fn);
  if (i < 0) { console.log("--- " + fn + ": not found in editor"); continue; }
  console.log("=== function " + fn + " @ editor+" + i + " ===");
  console.log(editor.slice(i, i + 900));
  console.log();
}
// 找头像点击处理
let j = editor.indexOf("avatar");
while (j >= 0 && j < editor.length) {
  const ctx = editor.slice(Math.max(0, j - 100), j + 150);
  if (/click|change|更换/.test(ctx)) {
    console.log("=== avatar ctx @ " + j + " ===");
    console.log(ctx);
    console.log();
  }
  j = editor.indexOf("avatar", j + 1);
  if (j > 60000) break;
}
