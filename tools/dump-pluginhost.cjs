// 提取渲染进程插件宿主核心代码
const fs = require("fs");
const path = require("path");
const s = fs.readFileSync(path.join(__dirname, "renderer-main.js"), "utf8");

// setSettingsSchema @ 13994078，往前找 load 函数定义区域
const start = s.lastIndexOf("async function load$1", 13994078);
console.log("load$1 def at:", s.indexOf("async function load$1"));
// 找包含插件加载的大区域
const regionStart = s.lastIndexOf("plugins$1", 13994078) - 3000;
const region = s.slice(regionStart, 13994078 + 1500);
console.log(region);
