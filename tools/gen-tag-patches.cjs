// 生成标签功能补丁文件（find 精确取自源码，replace 为新增代码）
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync("E:/Siyuan/One/data/plugins/siyuan-diaryflow/index.js", "utf8");
const marks = {
  storage: src.indexOf("// src/storage.js"),
  render: src.indexOf("// src/render.js"),
  editor: src.indexOf("// src/editor.js"),
};
const ca = (a, b) => src.slice(a, b);
const P = "C:/Users/i5156/AppData/Roaming/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a866bb5ecf6cdbfe97f12e7/orca-diaryflow/patches/";
const w = (name, find, rep) => {
  const fp = (k) => P + name + "." + k + ".txt";
  if (find == null || src.indexOf(find) < 0) { console.log("FAIL anchor:", name); process.exit(1); }
  fs.writeFileSync(fp("find"), find);
  fs.writeFileSync(fp("replace"), rep);
  console.log("OK", name, "find", find.length, "B, rep", rep.length, "B");
};

// ========== P17 数据字段：normalizeItem 加 tags ==========
{
  const f = "        location: m.location || \"\"";
  const r = "        location: m.location || \"\",\n        tags: Array.isArray(m.tags) ? m.tags.filter(Boolean).slice(0, 20) : []";
  w("P17-tags-storage", f, r);
}

// ========== P18 编辑器初始化 d 加 tags ==========
{
  const f = "const d = { text: \"\", link: \"\", linkTitle: \"\", location: \"\", images: [] };";
  const r = "const d = { text: \"\", link: \"\", linkTitle: \"\", location: \"\", tags: [], images: [] };";
  w("P18-tags-editinit", f, r);
}

// ========== P19 编辑器标签输入框 ==========
{
  const f = "          <input type=\"text\" class=\"mom-publish-inp mom-publish-info-loc\" data-location placeholder=\"\\u5730\\u70B9...\" value=\"${esc(d.location)}\">";
  const r = "          <input type=\"text\" class=\"mom-publish-inp mom-publish-info-loc\" data-location placeholder=\"\\u5730\\u70B9...\" value=\"${esc(d.location)}\">\n          <input type=\"text\" class=\"mom-publish-inp mom-publish-info-tags\" data-tags placeholder=\"\\u6807\\u7B7E\\uff08\\u7528\\u9017\\u53F7\\u3001\\u7A7A\\u683C\\u6216 # \\u5206\\u9694\\uff09\" value=\"${esc((d.tags || []).join(\", \"))}\">";
  w("P19-tags-editinput", f, r);
}

// ========== P20 编辑器保存解析 tags ==========
{
  const f = "        d.location = q(\"[data-location]\").value.trim();";
  const r = "        d.location = q(\"[data-location]\").value.trim();\n        d.tags = (q(\"[data-tags]\").value || \"\").split(/[,\\uFF0C\\s]+/).map((t) => t.replace(/^#/, \"\").trim()).filter(Boolean).slice(0, 20);";
  w("P20-tags-editsave", f, r);
}

// ========== P21 渲染 tagsHtml 函数 ==========
{
  const f = "    function metaTags(it) {";
  const r = `    function tagsHtml(it) {
      const tags = (it.tags || []).filter(Boolean);
      if (!tags.length) return "";
      return \`<div class="north-luna-moments-tags">\${tags.map((t) => \`<span class="north-luna-moments-tag" data-action="search-tag" data-tag="\${esc(t)}">#\${esc(t)}</span>\`).join("")}</div>\`;
    }
    function metaTags(it) {`;
  w("P21-tags-html-fn", f, r);
}

// ========== P22 cardHtml 插入 tagsHtml ==========
{
  const f = "        ${expandHtml(it)}\n        ${mediaHtml(it)}\n        <div class=\"north-luna-moments-item-meta\">";
  const r = "        ${expandHtml(it)}\n        ${mediaHtml(it)}\n        ${tagsHtml(it)}\n        <div class=\"north-luna-moments-item-meta\">";
  w("P22-tags-carddl", f, r);
}

// ========== P23 过滤：kw 匹配文案 + 标签 ==========
{
  const f = "        if (f.kw) {\n          const t = (it.text || \"\").toLowerCase();\n          if (!t.includes(f.kw.toLowerCase())) return false;\n        }";
  const r = "        if (f.kw) {\n          const kw = String(f.kw).toLowerCase();\n          const t = (((it.text || \"\") + \" \" + ((it.tags || []).join(\" \"))) + \"\").toLowerCase();\n          if (kw.startsWith(\"#\")) {\n            const tagOnly = ((it.tags || []).map((g) => \"#\" + g).join(\" \")).toLowerCase();\n            if (!tagOnly.includes(kw)) return false;\n          } else if (!t.includes(kw)) {\n            return false;\n          }\n        }";
  w("P23-tags-filter", f, r);
}

// ========== P24 点击标签过滤 handle case ==========
{
  const f = "        case \"like\": {";
  const r = `        case "search-tag": {
          const t = btn.getAttribute("data-tag");
          if (t) {
            ctx.filters.kw = "#" + t;
            ctx.showMessage && ctx.showMessage("已按标签过滤 #" + t);
            ctx.reApp();
          }
          break;
        }
        case "like": {`;
  w("P24-tags-handle", f, r);
}

console.log("\n全部补丁已生成");