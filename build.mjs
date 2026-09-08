// build.mjs — 将思源版 siyuan-diaryflow 构建为 Orca Note 插件
// 用法：node build.mjs
// 流程：拆分原 bundle 模块 → 应用 patches/ 补丁 → 拼接 Orca 入口 + CSS → 输出 dist/index.js

import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = "E:/Siyuan/One/data/plugins/siyuan-diaryflow";
const SRC = SRC_DIR + "/index.js";
const SRC_CSS = SRC_DIR + "/index.css";
const SRC_ICON = SRC_DIR + "/icon.png";

const bundle = readFileSync(SRC, "utf8");

// ---------- 模块拆分 ----------
const M = [
  "// src/storage.js",
  "// src/util.js",
  "// src/render.js",
  "// src/export.js",
  "// src/editor.js",
  "// src/index.js"
];
const at = M.map((m) => bundle.indexOf(m));
at.forEach((pos, i) => {
  if (pos < 0) {
    console.error("FATAL: module marker not found:", M[i]);
    process.exit(1);
  }
});

const header = bundle.slice(0, at[0]);
const blocks = {
  storage: bundle.slice(at[0], at[1]),
  util: bundle.slice(at[1], at[2]),
  render: bundle.slice(at[2], at[3]),
  export: bundle.slice(at[3], at[4]),
  editor: bundle.slice(at[4], at[5])
};

// ---------- 补丁 ----------
const patches = [
  { block: "render", name: "P01-icons-dict" },
  { block: "render", name: "P02-ico-use" },
  { block: "render", name: "P03-popupbtn" },
  { block: "render", name: "P04-pinbadge" },
  { block: "render", name: "P05-iconclose", all: true },
  { block: "editor", name: "P05-iconclose", all: true },
  { block: "util", name: "P06-esc" },
  { block: "editor", name: "P07-assetdir" },
  { block: "editor", name: "P08-upload" },
  { block: "editor", name: "P09-readdir" },
  { block: "editor", name: "P10-pickerbg" },
  { block: "editor", name: "P11-coversrc" },
  { block: "export", name: "P12-exportmd" },
  { block: "export", name: "P13-exportword" },
  { block: "editor", name: "P14-videolb" },
  { block: "editor", name: "P15-overlaybase" },
  { block: "render", name: "P16-rmresource" },
  { block: "storage", name: "P17-tags-storage" },
  { block: "editor", name: "P18-tags-editinit" },
  { block: "editor", name: "P19-tags-editinput" },
  { block: "editor", name: "P20-tags-editsave" },
  { block: "render", name: "P21-tags-html-fn" },
  { block: "render", name: "P22-tags-carddl" },
  { block: "render", name: "P23-tags-filter" },
  { block: "editor", name: "P24-tags-handle" },
  { block: "render", name: "P25-rmupload" },
  { block: "render", name: "P26-rmdelete" },
  { block: "render", name: "P27-empty-hint" }
];

function applyPatch(block, name, all) {
  const find = readFileSync(join(ROOT, "patches", name + ".find.txt"), "utf8");
  const rep = readFileSync(join(ROOT, "patches", name + ".replace.txt"), "utf8");
  let s = blocks[block];
  const i = s.indexOf(find);
  if (i < 0) {
    console.error("PATCH FAILED:", block, name);
    process.exit(1);
  }
  if (!all && s.indexOf(find, i + 1) >= 0) {
    console.error("PATCH AMBIGUOUS:", block, name);
    process.exit(1);
  }
  if (all) {
    while (s.indexOf(find) >= 0) s = s.replace(find, rep);
  } else {
    s = s.slice(0, i) + rep + s.slice(i + find.length);
  }
  blocks[block] = s;
  console.log("patched:", block, name);
}

for (const p of patches) applyPatch(p.block, p.name, p.all);

// ---------- 残留检查 ----------
const leftovers = ["xlink:href", "api/file/", "window.siyuan", "ASSET_URL", "ASSET_DIR", "ensureAssetDir", "putFile"];
for (const [k, v] of Object.entries(blocks)) {
  for (const bad of leftovers) {
    if (v.includes(bad)) {
      console.error("LEFTOVER in", k, ":", bad);
      process.exit(1);
    }
  }
}
console.log("no siyuan leftovers in modules");

// ---------- CSS ----------
const css = readFileSync(SRC_CSS, "utf8");
const extraCss = [
  "",
  "/* ===== Orca Note adaptation (appended by build.mjs) ===== */",
  ".orca-df-host { height: 100%; min-height: 0; }",
  ".orca-df-scope .mom-root { height: 100%; }",
  ".orca-df-scope {",
  "  --b3-theme-background: #f5f6f8;",
  "  --b3-theme-background-light: rgba(255,255,255,0.78);",
  "  --b3-theme-on-background: #24292f;",
  "  --b3-theme-primary: #3575f0;",
  "  --b3-theme-primary-light: #6a95f4;",
  "  --b3-theme-primary-lighter: #e2ecfd;",
  "  --b3-theme-primary-lightest: #f0f5fe;",
  "  --b3-border-color: #e5e7eb;",
  "  --b3-theme-surface: #ffffff;",
  "  --b3-theme-surface-lighter: #f0f1f4;",
  "  --b3-theme-on-surface: #24292f;",
  "  --b3-theme-on-surface-light: #6b7280;",
  "  --b3-list-hover: #eceef2;",
  "  --b3-font-family-code: ui-monospace, \"Cascadia Code\", Consolas, \"Courier New\", monospace;",
  "  color: var(--b3-theme-on-background);",
  "}",
  ".orca-df-scope.orca-df-dark {",
  "  --b3-theme-background: #1b1e24;",
  "  --b3-theme-background-light: rgba(30,33,40,0.78);",
  "  --b3-theme-on-background: #d7dde5;",
  "  --b3-theme-primary: #4c88ff;",
  "  --b3-theme-primary-light: #7aa7ff;",
  "  --b3-theme-primary-lighter: #263650;",
  "  --b3-theme-primary-lightest: #1f2c42;",
  "  --b3-border-color: #363b45;",
  "  --b3-theme-surface: #242830;",
  "  --b3-theme-surface-lighter: #2c313b;",
  "  --b3-theme-on-surface: #d7dde5;",
  "  --b3-theme-on-surface-light: #9aa3af;",
  "  --b3-list-hover: #2c313b;",
  "}",
  ".orca-df-hb-icon { display: inline-flex; align-items: center; justify-content: center; }",
  ".orca-df-hb-icon svg { display: block; }",
  "/* ---- 标签功能 ---- */",
  ".north-luna-moments-tags { display: flex; flex-wrap: wrap; gap: 6px 8px; margin-top: 10px; }",
  ".north-luna-moments-tag { font-size: 12px; line-height: 1.6; color: var(--b3-theme-primary); background: var(--b3-theme-primary-lightest); padding: 1px 9px; border-radius: 9px; cursor: pointer; user-select: none; transition: background 0.15s; }",
  ".north-luna-moments-tag:hover { background: var(--b3-theme-primary-lighter); }",
  ".mom-publish-info { flex-wrap: wrap; }",
  ".mom-publish-info .mom-publish-info-tags { flex: 1 1 100%; min-width: 0; margin-top: 4px; }",
  "/* ---- 空状态美化 ---- */",
  ".mom-empty { padding: 60px 24px 48px; text-align: center; }",
  ".mom-empty-ico { font-size: 46px; line-height: 1; margin-bottom: 16px; opacity: 0.85; }",
  ".mom-empty-title { font-size: 16px; font-weight: 600; margin: 0 0 8px; color: var(--b3-theme-on-surface, #24292f); }",
  ".mom-empty-sub { font-size: 13px; line-height: 1.7; margin: 0 0 6px; color: var(--b3-theme-on-surface-light, #6b7280); }",
  ".mom-empty-hint { font-size: 12px; line-height: 1.7; margin: 0 0 20px; color: var(--b3-theme-on-surface-light, #6b7280); opacity: 0.8; }",
  ".mom-empty-btn { margin-top: 4px; }",
  "/* ---- 内容占满面板（适配宽面板，覆盖思源窄栏 73%/居中限制） ---- */",
  ".orca-df-scope .mom-list { align-items: stretch; padding-left: 16px; padding-right: 16px; }",
  ".orca-df-scope .mom-filter-bar, .orca-df-scope .mom-pin-strip { width: 100%; }",
  ".orca-df-scope .north-luna-moments-item { width: 100%; }"
].join("\n");
const allCss = css + extraCss;

// ---------- 组装输出 ----------
const entry = readFileSync(join(ROOT, "src", "orca-entry.js"), "utf8");

const out = [
  "// orca-diaryflow v0.1.0 — built from siyuan-diaryflow by build.mjs",
  "// Orca Note adaptation: panel, plugin-file media assets, theme scoping",
  header,
  blocks.storage,
  blocks.util,
  blocks.render,
  blocks.export,
  blocks.editor,
  "",
  "// ===== Orca Note entry =====",
  "var ORCA_CSS = " + JSON.stringify(allCss) + ";",
  "",
  entry
].join("\n");

mkdirSync(join(ROOT, "dist"), { recursive: true });
writeFileSync(join(ROOT, "dist", "index.js"), out);
copyFileSync(SRC_ICON, join(ROOT, "icon.png"));

// plugin.json（mreader 同款格式）
const pluginMeta = {
  name: "orca-diaryflow",
  author: "kx1356",
  url: "",
  version: "0.1.0",
  minAppVersion: "2.10.0",
  script: "index.js",
  description: {
    default: "Moments-style diary feed with images, comments and calendar review for Orca Note",
    zh_CN: "日记流：清爽的记录与回顾视图，支持图文与评论互动"
  },
  displayName: {
    default: "日记流",
    zh_CN: "日记流"
  },
  icon: "icon.png",
  backends: [],
  i18n: ["zh_CN", "en_US"]
};
writeFileSync(join(ROOT, "plugin.json"), JSON.stringify(pluginMeta, null, 4) + "\n");

// package.json（构建标准格式）
const pkgMeta = {
  name: "orca-diaryflow",
  version: "0.1.0",
  type: "module",
  description: "日记流：清爽的记录与回顾视图，支持图文与评论互动（Orca Note 版）",
  author: "kx1356",
  private: true,
  peerDependencies: {
    react: "^18.2.0",
    valtio: "^1.13.2"
  }
};
writeFileSync(join(ROOT, "package.json"), JSON.stringify(pkgMeta, null, 2) + "\n");

console.log("built dist/index.js:", out.length, "bytes");
console.log("dist ready at", join(ROOT, "dist", "index.js"));
