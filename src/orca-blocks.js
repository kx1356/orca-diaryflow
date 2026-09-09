// ============================================================
// src/orca-blocks.js — 日记流深融合虎鲸：块存储 / 查询 / 迁移
// 主存：日记页子块 + 固定标签「日记流」；插件侧只留配置与评论索引
// ============================================================

var DF_TAG = "日记流";
var DF_INDEX_KEY = "moments-index";
var DF_BACKUP_KEY = "moments-records-backup";
var DF_MIGRATED_KEY = "moments-migrated";
var DF_REF_TAG = 2; // BlockRef type: tag / property tag
var DF_LOC_PROP = "df.location";
var DF_PROP_TEXT = 1; // PropType.Text

function dfIsId(v) {
  return typeof v === "number" && isFinite(v) && v > 0;
}

function dfBlockId(v) {
  if (dfIsId(v)) return v;
  if (v && dfIsId(v.id)) return v.id;
  if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
  return null;
}

function dfFmtCreated(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) d = new Date();
  function p2(n) { return String(n).padStart(2, "0"); }
  return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()) +
    " " + p2(d.getHours()) + ":" + p2(d.getMinutes());
}

function dfTagsOf(block) {
  var refs = (block && block.refs) || [];
  var out = [];
  for (var i = 0; i < refs.length; i++) {
    var r = refs[i];
    if (r && r.type === DF_REF_TAG && r.alias && r.alias !== DF_TAG) out.push(String(r.alias));
  }
  return out;
}

function dfHasTag(block, tagName) {
  var refs = (block && block.refs) || [];
  for (var i = 0; i < refs.length; i++) {
    var r = refs[i];
    if (r && r.type === DF_REF_TAG && r.alias === tagName) return true;
  }
  return false;
}

function dfOutgoingRefs(block) {
  var refs = (block && block.refs) || [];
  var out = [];
  var seen = {};
  function push(id, alias, type) {
    id = dfBlockId(id);
    if (!id || seen[id]) return;
    seen[id] = true;
    out.push({ id: id, alias: alias || "", type: type == null ? 1 : type });
  }
  for (var i = 0; i < refs.length; i++) {
    var r = refs[i];
    if (!r || r.type === DF_REF_TAG) continue;
    push(r.to, r.alias || dfTargetAliasLabel(r.to), r.type);
  }
  // content 里 t:"r" 的 v 是 refId，需解析到 to
  var content = (block && block.content) || [];
  for (var j = 0; j < content.length; j++) {
    var f = content[j];
    if (!f || f.t !== "r" || f.u) continue;
    var resolved = dfResolveRefFrag(f, block);
    if (!resolved || !resolved.to) continue;
    push(resolved.to, resolved.alias || dfTargetAliasLabel(resolved.to), 1);
  }
  return out;
}

function dfEscapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 去掉正文里与标签 chip 重复的「#标签」字样。
 * 同时处理半角/全角 #，以及 `#a,#b` / `#a #b` 连写；未知 #token 一并去掉（时间流正文不展示 hashtag）。
 */
function dfStripInlineTagText(text, tagNames) {
  var s = String(text == null ? "" : text);
  if (!s) return "";
  s = s.replace(/\uFF03/g, "#"); // 全角 ＃ → #
  // 保护日记流内联块引用，避免被 #token 扫尾误伤
  var holds = [];
  s = s.replace(/\[[^\]]*\]\(dfref:\d+\)/g, function (m) {
    holds.push(m);
    return "\0DFREF" + (holds.length - 1) + "\0";
  });
  var names = [];
  var seen = {};
  function add(t) {
    t = String(t || "").replace(/^#/, "").trim();
    if (!t || seen[t]) return;
    seen[t] = true;
    names.push(t);
  }
  add(DF_TAG);
  (tagNames || []).forEach(add);
  names.sort(function (a, b) { return b.length - a.length; });
  for (var i = 0; i < names.length; i++) {
    var re = new RegExp("#" + dfEscapeRe(names[i]) + "(?=$|[\\s,，、#])", "g");
    s = s.replace(re, "");
  }
  // 扫尾：去掉剩余 #标签token（避免 Orca .text 展平或脏写入残留）
  s = s.replace(/#[^\s#，,、]+/g, "");
  s = s.replace(/[\s]*[,，、]+[\s]*/g, " ");
  s = s.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  s = s.replace(/\0DFREF(\d+)\0/g, function (_m, idx) {
    return holds[Number(idx)] || "";
  });
  return s.trim();
}

/** 仅统计 content 里的纯文本节点（不含 tag ref），用于判断是否被写脏 */
function dfPlainContentText(block) {
  var c = block && block.content;
  if (!Array.isArray(c) || !c.length) return null;
  var parts = [];
  for (var i = 0; i < c.length; i++) {
    var x = c[i];
    if (x && x.t === "t" && x.v) parts.push(String(x.v));
  }
  return parts.join("");
}

/**
 * 行内 markdown → 虎鲸 ContentFragment[]
 * 对应：粗体 ** / 斜体 * / 下划线 __ / 删除 ~~ / 高亮 == / 代码 ` / 链接 [text](url)
 * 格式码：b / i / u(+us solid) / s / bc(+bcc) / c；链接 t:"r"+u
 */
function dfMarkdownLineToFragments(line) {
  var s = String(line == null ? "" : line);
  if (!s) return [{ t: "t", v: "" }];
  var out = [];
  // 链接 / 代码 / 高亮 / 删除 / 下划线 / 粗体 / 斜体（顺序：长标记优先）
  var re = /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)|`([^`\n]+)`|==([^=\n]+)==|~~([^~\n]+)~~|__([^_\n]+)__|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g;
  var last = 0;
  var m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ t: "t", v: s.slice(last, m.index) });
    if (m[1] != null) {
      out.push({ t: "r", v: m[1], u: m[2] });
    } else if (m[3] != null) {
      out.push({ t: "t", v: m[3], f: "c" });
    } else if (m[4] != null) {
      out.push({ t: "t", v: m[4], f: "bc", fa: { bcc: "yellow" } });
    } else if (m[5] != null) {
      out.push({ t: "t", v: m[5], f: "s" });
    } else if (m[6] != null) {
      out.push({ t: "t", v: m[6], f: "u", fa: { us: "solid" } });
    } else if (m[7] != null) {
      out.push({ t: "t", v: m[7], f: "b" });
    } else if (m[8] != null) {
      out.push({ t: "t", v: m[8], f: "i" });
    }
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ t: "t", v: s.slice(last) });
  if (!out.length) out.push({ t: "t", v: "" });
  return out;
}

function dfFragToMarkdown(frag) {
  if (!frag) return "";
  if (frag.t === "r") {
    if (frag.u) {
      var label = (typeof frag.v === "string" && frag.v) ? frag.v : String(frag.u);
      return "[" + label + "](" + frag.u + ")";
    }
    // 块引用：留给带 block 上下文的转换
    return "";
  }
  if (frag.t === "l") {
    // 插件/特殊链接：{ t:"l", v:名, l:url }
    var href = frag.l || frag.u || "";
    var title = frag.v != null ? String(frag.v) : href;
    if (href) return "[" + title + "](" + href + ")";
    return title;
  }
  if (frag.t === "mt") {
    // mention / 特殊内联：尽量当块引用展示
    var mid = dfBlockId(frag.v);
    if (mid) return "[↗ #" + mid + "](dfref:" + mid + ")";
    return frag.v != null ? String(frag.v) : "";
  }
  if (frag.t && frag.t !== "t") return "";
  var v = String(frag.v == null ? "" : frag.v);
  var f = frag.f || "";
  if (!f || f === "fc") return v;
  if (f === "bc") return "==" + v + "==";
  if (f === "u") return "__" + v + "__";
  if (f === "c") return "`" + v + "`";
  if (f === "s") return "~~" + v + "~~";
  if (f === "i") return "*" + v + "*";
  if (f === "b") return "**" + v + "**";
  if (f.indexOf("c") >= 0) return "`" + v + "`";
  if (f.indexOf("s") >= 0) return "~~" + v + "~~";
  if (f.indexOf("u") >= 0) return "__" + v + "__";
  if (f.indexOf("b") >= 0 && f.indexOf("i") >= 0) return "***" + v + "***";
  if (f.indexOf("b") >= 0) return "**" + v + "**";
  if (f.indexOf("i") >= 0) return "*" + v + "*";
  return v;
}

/** refId → { to, alias }；content 里 t:"r" 的 v 是 BlockRef.id，不是块 id */
var DF_REF_CACHE = {};

function dfTargetAliasLabel(toId) {
  var to = dfBlockId(toId);
  var target = to && orca.state.blocks ? orca.state.blocks[to] : null;
  if (target && Array.isArray(target.aliases) && target.aliases.length) {
    var a = String(target.aliases[0] || "");
    if (a.startsWith("/")) {
      var parts = a.split("/");
      a = parts[parts.length - 1] || a;
    }
    if (a) return a;
  }
  // 对齐虎鲸：有别名才用别名；没有再用短正文，避免整段正文当引用名
  if (target) {
    var plain = dfPlainContentText(target);
    if (!plain) plain = String(target.text || "").trim();
    plain = String(plain || "").replace(/\s+/g, " ").trim();
    if (plain) return plain.length > 18 ? plain.slice(0, 18) + "…" : plain;
  }
  return to ? ("#" + to) : "?";
}

/** 解析行内引用 fragment → { to, alias, refId } */
function dfResolveRefFrag(frag, block) {
  if (!frag || frag.t !== "r" || frag.u) return null;
  var refId = dfBlockId(frag.v);
  var alias = "";
  if (typeof frag.a === "string" && frag.a) alias = frag.a;
  else if (typeof frag.alias === "string" && frag.alias) alias = frag.alias;

  var to = null;
  var refs = (block && block.refs) || [];
  for (var i = 0; i < refs.length; i++) {
    if (refs[i] && refs[i].id === refId) {
      to = dfBlockId(refs[i].to);
      if (!alias && refs[i].alias) alias = String(refs[i].alias);
      break;
    }
  }
  if (!to && DF_REF_CACHE[refId]) {
    to = dfBlockId(DF_REF_CACHE[refId].to);
    if (!alias && DF_REF_CACHE[refId].alias) alias = String(DF_REF_CACHE[refId].alias);
  }
  // 兼容旧误判：少数情况下 v 直接是块 id
  if (!to && orca.state.blocks && orca.state.blocks[refId] && !DF_REF_CACHE[refId]) {
    to = refId;
  }
  if (!to && DF_REF_CACHE[refId]) to = dfBlockId(DF_REF_CACHE[refId].to);
  return { refId: refId, to: to, alias: alias };
}

function dfRefDisplayLabel(fragOrId, block) {
  var frag = fragOrId && typeof fragOrId === "object" ? fragOrId : null;
  if (frag && frag.t === "r") {
    var resolved = dfResolveRefFrag(frag, block);
    if (resolved) {
      if (resolved.alias) return resolved.alias;
      if (resolved.to) return dfTargetAliasLabel(resolved.to);
    }
  }
  var id = dfBlockId(fragOrId && fragOrId.v != null ? fragOrId.v : fragOrId);
  // block.refs 里按 to 找（芯片用）
  var refs = (block && block.refs) || [];
  for (var i = 0; i < refs.length; i++) {
    if (refs[i] && refs[i].to === id && refs[i].alias) return String(refs[i].alias);
  }
  return dfTargetAliasLabel(id);
}

function dfContentToMarkdown(content, block) {
  if (!Array.isArray(content) || !content.length) return "";
  var parts = [];
  for (var i = 0; i < content.length; i++) {
    var frag = content[i];
    if (frag && frag.t === "r" && !frag.u) {
      var resolved = dfResolveRefFrag(frag, block);
      var rid = resolved && resolved.to ? resolved.to : dfBlockId(frag.v);
      if (rid) {
        var lab = dfRefDisplayLabel(frag, block).replace(/[\[\]]/g, "");
        parts.push("[↗ " + lab + "](dfref:" + rid + ")");
        continue;
      }
    }
    if (frag && frag.t === "mt") {
      var mid = dfBlockId(frag.v);
      if (mid) {
        var mlab = dfTargetAliasLabel(mid).replace(/[\[\]]/g, "");
        parts.push("[↗ " + mlab + "](dfref:" + mid + ")");
        continue;
      }
    }
    parts.push(dfFragToMarkdown(frag));
  }
  return parts.join("");
}

function dfContentHasInlineSpecial(content) {
  return dfContentHasStructuralFrags(content) || dfContentHasRich(content);
}

function dfBlockLineMarkdown(block, tags) {
  if (!block) return "";
  var content = block.content;
  var md;
  if (Array.isArray(content) && content.length) {
    md = dfContentToMarkdown(content, block);
    if (!String(md).trim()) md = String(block.text || "").trim();
  } else {
    md = String(block.text || "").trim();
  }
  return dfStripInlineTagText(md, tags || dfTagsOf(block));
}

function dfContentHasRich(content) {
  if (!Array.isArray(content)) return false;
  for (var i = 0; i < content.length; i++) {
    var x = content[i];
    if (!x) continue;
    if (x.f) return true;
    if (x.t === "r") return true;
    if (x.t === "l" || x.t === "mt") return true;
  }
  return false;
}

function dfContentHasStructuralFrags(content) {
  if (!Array.isArray(content)) return false;
  for (var i = 0; i < content.length; i++) {
    var x = content[i];
    if (x && (x.t === "r" || x.t === "l" || x.t === "mt")) return true;
  }
  return false;
}

async function dfGetRefInfo(refId) {
  refId = dfBlockId(refId);
  if (!refId) return null;
  if (DF_REF_CACHE[refId]) return DF_REF_CACHE[refId];
  try {
    var info = await orca.invokeBackend("get-ref", refId);
    if (info && info.to != null) {
      DF_REF_CACHE[refId] = {
        to: dfBlockId(info.to),
        alias: info.alias ? String(info.alias) : ""
      };
      return DF_REF_CACHE[refId];
    }
  } catch (e) { /* ignore */ }
  return null;
}

async function dfPrefetchRefTargets(block) {
  if (!block) return;
  var refIds = [];
  var seenRef = {};
  function addRef(id) {
    id = dfBlockId(id);
    if (!id || seenRef[id] || DF_REF_CACHE[id]) return;
    seenRef[id] = true;
    refIds.push(id);
  }
  var content = block.content || [];
  for (var i = 0; i < content.length; i++) {
    var f = content[i];
    if (f && f.t === "r" && !f.u) addRef(f.v);
  }
  // 并行解析 refId → { to, alias }
  if (refIds.length) {
    await Promise.all(refIds.map(function (rid) { return dfGetRefInfo(rid); }));
  }
  // 再拉目标块（别名/正文）
  var ids = [];
  var seen = {};
  function add(id) {
    id = dfBlockId(id);
    if (!id || seen[id] || (orca.state.blocks && orca.state.blocks[id])) return;
    seen[id] = true;
    ids.push(id);
  }
  for (var j = 0; j < refIds.length; j++) {
    var cached = DF_REF_CACHE[refIds[j]];
    if (cached) add(cached.to);
  }
  var refs = block.refs || [];
  for (var k = 0; k < refs.length; k++) {
    if (refs[k] && refs[k].type !== DF_REF_TAG) add(refs[k].to);
  }
  for (var m = 0; m < content.length; m++) {
    var frag = content[m];
    if (frag && frag.t === "mt" && !frag.u) add(frag.v);
  }
  if (!ids.length) return;
  try {
    var got = await orca.invokeBackend("get-blocks", ids);
    if (Array.isArray(got)) got.forEach(function (b) { if (b && b.id) orca.state.blocks[b.id] = b; });
  } catch (e) { /* ignore */ }
}

async function dfHealPlainTagText(block) {
  if (!block || !dfIsId(block.id)) return block;
  // 含行内引用/特殊 fragment 时禁止整块 markdown 回写，否则会毁掉引用
  if (dfContentHasStructuralFrags(block.content)) return block;
  var tags = dfTagsOf(block);
  var plain = dfPlainContentText(block);
  // 优先按 content→markdown 清洗，避免把粗体等格式写回成字面量
  var raw = dfContentHasRich(block.content)
    ? dfContentToMarkdown(block.content, block)
    : (plain != null ? plain : String(block.text || ""));
  if (!raw) return block;
  var clean = dfStripInlineTagText(raw, tags);
  if (clean === String(raw).trim()) return block;
  // .text 可能只是「正文+标签」展平；仅当纯文本节点里已含 #标签，或能确认 content 脏时才改块
  if (plain == null && !dfContentHasRich(block.content)) {
    var hasHashTag = raw.indexOf("#" + DF_TAG) >= 0 ||
      tags.some(function (t) { return raw.indexOf("#" + t) >= 0; });
    if (!hasHashTag) return block;
  }
  try {
    await dfWithEditor(async function () {
      await dfEditorCommand("core.editor.setBlocksContent", null, [{
        id: block.id,
        content: clean ? dfMarkdownLineToFragments(clean) : [{ t: "t", v: "" }]
      }], false);
      try { await dfEditorCommand("core.editor.insertTag", null, block.id, DF_TAG); } catch (e) { /* ignore */ }
      for (var i = 0; i < tags.length; i++) {
        try { await dfEditorCommand("core.editor.insertTag", null, block.id, tags[i]); } catch (e2) { /* ignore */ }
      }
    });
    delete orca.state.blocks[block.id];
    var fresh = await dfGetBlock(block.id);
    return fresh || block;
  } catch (e) {
    console.warn("[orca-diaryflow] heal plain tag text failed", block.id, e);
    return block;
  }
}

function dfProp(block, name) {
  var props = (block && block.properties) || [];
  for (var i = 0; i < props.length; i++) {
    if (props[i] && props[i].name === name) return props[i].value;
  }
  return null;
}

async function dfEnsureJournal(date) {
  var d = date instanceof Date ? date : new Date(date || Date.now());
  if (isNaN(d.getTime())) d = new Date();
  var j = await orca.invokeBackend("get-journal-block", d);
  var id = dfBlockId(j);
  if (!id) throw new Error("get-journal-block 未返回有效日记块");
  if (j && typeof j === "object" && j.id) {
    orca.state.blocks[j.id] = j;
    return j;
  }
  var b = await orca.invokeBackend("get-block", id);
  if (b) orca.state.blocks[b.id] = b;
  return b || { id: id };
}

async function dfGetBlock(id) {
  if (!dfIsId(id)) return null;
  var cached = orca.state.blocks && orca.state.blocks[id];
  if (cached) return cached;
  try {
    var b = await orca.invokeBackend("get-block", id);
    if (b) orca.state.blocks[b.id] = b;
    return b;
  } catch (e) {
    return null;
  }
}

async function dfCollectImageSrcs(block) {
  var imgs = [];
  var DF_IMG_CAP = 99;
  async function pushFrom(c) {
    if (!c || imgs.length >= DF_IMG_CAP) return false;
    var repr = c._repr || c.repr || {};
    // _repr 也可能在 properties
    if (!repr.type) {
      var raw = dfProp(c, "_repr");
      if (raw && typeof raw === "object") repr = raw;
      else if (typeof raw === "string") {
        try { repr = JSON.parse(raw); } catch (e) { repr = {}; }
      }
    }
    var type = repr.type || "";
    if (type !== "image" && type !== "video") return false;
    var src = repr.src || repr.path || dfProp(c, "src") || "";
    if (src) imgs.push(String(src));
    return true;
  }

  var kids = (block && block.children) || [];
  if (kids.length) {
    var need = kids.filter(function (id) { return !orca.state.blocks[id]; });
    if (need.length) {
      try {
        var got = await orca.invokeBackend("get-blocks", need);
        if (Array.isArray(got)) {
          got.forEach(function (b) { if (b && b.id) orca.state.blocks[b.id] = b; });
        }
      } catch (e) { /* ignore */ }
    }
    for (var i = 0; i < kids.length && imgs.length < DF_IMG_CAP; i++) {
      await pushFrom(orca.state.blocks[kids[i]]);
    }
  }

  // 虎鲸原生插入图片是「同级 after」，也扫紧随其后的媒体兄弟块
  if (block && dfIsId(block.parent) && imgs.length < DF_IMG_CAP) {
    var parent = orca.state.blocks[block.parent] || await dfGetBlock(block.parent);
    var sibs = (parent && parent.children) || [];
    var idx = sibs.indexOf(block.id);
    if (idx >= 0) {
      var miss = [];
      for (var j = idx + 1; j < sibs.length; j++) {
        if (!orca.state.blocks[sibs[j]]) miss.push(sibs[j]);
      }
      if (miss.length) {
        try {
          var got2 = await orca.invokeBackend("get-blocks", miss);
          if (Array.isArray(got2)) {
            got2.forEach(function (b) { if (b && b.id) orca.state.blocks[b.id] = b; });
          }
        } catch (e3) { /* ignore */ }
      }
      for (var k = idx + 1; k < sibs.length && imgs.length < DF_IMG_CAP; k++) {
        var ok = await pushFrom(orca.state.blocks[sibs[k]]);
        if (!ok) break;
      }
    }
  }
  return imgs;
}

/**
 * 虎鲸块图片 src 多为 `./xxx` 仓库相对路径；展示需转为 file://（与官方渲染一致）。
 * dfasset/blob/http/data 原样返回。
 */
function dfResolveOrcaAssetSrc(src) {
  if (!src) return "";
  src = String(src).trim();
  if (!src) return "";
  if (/^(https?:|data:|blob:|dfasset:|file:)/i.test(src)) return src;
  try {
    if (/^[A-Za-z]:[\\/]/.test(src) || src.startsWith("\\\\")) {
      return dfPathToFileUrl(src.replace(/\\/g, "/"));
    }
    if (src.startsWith("/") && !src.startsWith("//")) {
      return dfPathToFileUrl(src);
    }
    var isWin = false;
    try {
      var dd = String((orca.state && (orca.state.dataDir || orca.state.repoDir)) || "");
      isWin = /win/i.test(String((orca.state && orca.state.platform) || "")) || dd.indexOf("\\") >= 0 || /^[A-Za-z]:/.test(dd);
    } catch (e0) { /* ignore */ }
    var sep = isWin ? "\\" : "/";
    var rel = src.replace(/^\.\//, "").replace(/^\//, "");
    var repoDir = "";
    try {
      repoDir = (orca.state && orca.state.repoDir) || "";
      if (!repoDir && orca.state && orca.state.dataDir && orca.state.repo) {
        repoDir = orca.state.dataDir + sep + "repos" + sep + orca.state.repo;
      }
    } catch (e1) { /* ignore */ }
    if (!repoDir) return src;
    // 上传接口常返回 ./assets/xxx；勿再拼一层 assets/
    var fsPath = /^assets[\\/]/i.test(rel)
      ? (repoDir + sep + rel.split("/").join(sep))
      : (repoDir + sep + "assets" + sep + rel.split("/").join(sep));
    try {
      if (orca.utils && typeof orca.utils.getAssetPath === "function") {
        fsPath = orca.utils.getAssetPath(fsPath) || fsPath;
      }
    } catch (e2) { /* ignore */ }
    if (/^(file|https?):/i.test(fsPath)) return fsPath;
    return dfPathToFileUrl(fsPath);
  } catch (e) {
    return src;
  }
}

/** 绝对路径 → file://（分段 encode，避免中文/空格预览失败） */
function dfPathToFileUrl(fsPath) {
  var norm = String(fsPath || "").replace(/\\/g, "/");
  if (!norm) return "";
  var prefix = "";
  var body = norm;
  if (/^[A-Za-z]:\//.test(norm)) {
    prefix = "file:///";
  } else if (norm.startsWith("/")) {
    prefix = "file://";
  } else {
    prefix = "file:///";
  }
  var parts = body.split("/");
  var enc = parts.map(function (seg, i) {
    if (i === 0 && /^[A-Za-z]:$/.test(seg)) return seg;
    if (i === 0 && /^[A-Za-z]:/.test(seg)) {
      return seg.slice(0, 2) + encodeURIComponent(seg.slice(2));
    }
    if (!seg) return "";
    return encodeURIComponent(seg);
  }).join("/");
  return prefix + enc;
}

/** file:// → 仓库 assets 下的 ./ 相对路径；无法映射则返回 null */
function dfFileUrlToOrcaRel(fileUrl) {
  var u = String(fileUrl || "");
  if (!/^file:/i.test(u)) return null;
  var path = "";
  try { path = decodeURIComponent(u.replace(/^file:\/\//i, "")); } catch (e0) {
    path = u.replace(/^file:\/\//i, "");
  }
  if (/^\/[A-Za-z]:/.test(path)) path = path.slice(1);
  path = path.replace(/\\/g, "/");
  var repoDir = "";
  try {
    var sep = /\\/.test(String((orca.state && orca.state.repoDir) || "")) || /^[A-Za-z]:/.test(String((orca.state && orca.state.repoDir) || "")) ? "\\" : "/";
    repoDir = (orca.state && orca.state.repoDir) || "";
    if (!repoDir && orca.state && orca.state.dataDir && orca.state.repo) {
      repoDir = orca.state.dataDir + sep + "repos" + sep + orca.state.repo;
    }
  } catch (e1) { /* ignore */ }
  if (!repoDir) return null;
  var root = String(repoDir).replace(/\\/g, "/").replace(/\/+$/, "");
  var norm = path.replace(/\\/g, "/");
  var low = norm.toLowerCase();
  var rootLow = root.toLowerCase();
  var assetsLow = (root + "/assets/").toLowerCase();
  if (low.indexOf(assetsLow) === 0) {
    return "./" + norm.slice(root.length + "/assets/".length);
  }
  if (low.indexOf(rootLow + "/") === 0) {
    var rel = norm.slice(root.length + 1);
    if (/^assets\//i.test(rel)) return "./" + rel.slice("assets/".length);
    return "./" + rel;
  }
  return null;
}

function dfIsDisplayableImgSrc(s) {
  return !!s && /^(https?:|data:|blob:|dfasset:|file:)/i.test(String(s));
}

/** 把 dfasset/blob/dataURL/file 上传为虎鲸仓库资源，返回可用 src */
async function dfSrcToOrcaAsset(src) {
  if (!src) return null;
  src = String(src);
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("./")) return src;
  if (src.indexOf("://") < 0 && !src.startsWith("data:") && !src.startsWith("blob:") && !src.startsWith("dfasset:")) {
    return src.startsWith("/") ? "." + src : "./" + src.replace(/^\.\//, "");
  }

  // 编辑态已有 file://：优先映射回 ./，避免保存时丢掉旧图（只能留一张新图的假象）
  if (/^file:/i.test(src)) {
    try {
      var mapped = dfFileUrlToOrcaRel(src);
      if (mapped) return mapped;
    } catch (eMap) { /* ignore */ }
  }

  var mime = "image/jpeg";
  var buf = null;
  try {
    if (src.startsWith("dfasset://") && globalThis.__DF_ASSETS && typeof globalThis.__DF_ASSETS.toDataUrl === "function") {
      var dataUrl = await globalThis.__DF_ASSETS.toDataUrl(src);
      if (typeof dataUrl === "string" && dataUrl.indexOf(",") >= 0) src = dataUrl;
      else return null;
    }
    if (src.startsWith("data:")) {
      var m = src.match(/^data:([^;]+);base64,(.*)$/s);
      if (!m) return null;
      mime = m[1] || mime;
      var bin = atob(m[2]);
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      buf = arr.buffer;
    } else if (src.startsWith("blob:") || /^file:/i.test(src)) {
      var resp = await fetch(src);
      mime = (resp.headers && resp.headers.get("content-type")) || mime;
      buf = await resp.arrayBuffer();
    }
  } catch (e) {
    console.warn("[orca-diaryflow] read image failed", e);
    return null;
  }
  if (!buf) return null;
  try {
    var uploaded = await orca.invokeBackend("upload-asset-binary", mime, buf);
    return uploaded || null;
  } catch (e2) {
    console.warn("[orca-diaryflow] upload-asset-binary failed", e2);
    return null;
  }
}

async function dfListManagedMediaIds(blockId) {
  var id = dfBlockId(blockId);
  var block = await dfGetBlock(id);
  if (!block) return [];
  var out = [];
  function isMedia(c) {
    if (!c) return false;
    var repr = c._repr || c.repr || {};
    if (!repr.type) {
      var raw = dfProp(c, "_repr");
      if (raw && typeof raw === "object") repr = raw;
    }
    return repr.type === "image" || repr.type === "video";
  }
  var kids = block.children || [];
  for (var i = 0; i < kids.length; i++) {
    var c = orca.state.blocks[kids[i]] || await dfGetBlock(kids[i]);
    if (isMedia(c)) out.push(c.id);
  }
  // 兼容旧数据：曾把图片插成同级 after
  if (dfIsId(block.parent)) {
    var parent = orca.state.blocks[block.parent] || await dfGetBlock(block.parent);
    var sibs = (parent && parent.children) || [];
    var idx = sibs.indexOf(id);
    for (var j = idx + 1; j < sibs.length; j++) {
      var s = orca.state.blocks[sibs[j]] || await dfGetBlock(sibs[j]);
      if (!isMedia(s)) break;
      out.push(s.id);
    }
  }
  return out;
}

function dfIsMediaBlock(c) {
  if (!c) return false;
  var repr = dfBlockRepr(c);
  return repr.type === "image" || repr.type === "video";
}

function dfBlockRepr(block) {
  var repr = (block && (block._repr || block.repr)) || {};
  if (!repr.type) {
    var raw = dfProp(block, "_repr");
    if (raw && typeof raw === "object") repr = raw;
    else if (typeof raw === "string") {
      try { repr = JSON.parse(raw); } catch (e) { repr = {}; }
    }
  }
  return repr && typeof repr === "object" ? repr : {};
}

/** 从所属日记页 _repr.date 取展示日期（块 created 常是写入当天） */
async function dfJournalDateOfBlock(block) {
  var cur = block;
  for (var i = 0; i < 12 && cur; i++) {
    var repr = dfBlockRepr(cur);
    if (repr && repr.type === "journal" && repr.date) {
      var d = new Date(repr.date);
      if (!isNaN(d.getTime())) return d;
    }
    if (!dfIsId(cur.parent)) break;
    var pid = cur.parent;
    var cached = orca.state.blocks[pid];
    if (cached && dfBlockRepr(cached).type === "journal") {
      cur = cached;
      continue;
    }
    try { delete orca.state.blocks[pid]; } catch (e0) { /* ignore */ }
    cur = await dfGetBlock(pid);
  }
  return null;
}

function dfSameLocalDay(a, b) {
  if (!a || !b || isNaN(a.getTime()) || isNaN(b.getTime())) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

async function dfEnsureChildrenLoaded(block) {
  var kids = (block && block.children) || [];
  if (!kids.length) return kids;
  var need = kids.filter(function (id) { return !(orca.state.blocks && orca.state.blocks[id]); });
  if (need.length) {
    try {
      var got = await orca.invokeBackend("get-blocks", need);
      if (Array.isArray(got)) got.forEach(function (b) { if (b && b.id) orca.state.blocks[b.id] = b; });
    } catch (e) { /* ignore */ }
  }
  return kids;
}

/** 拉整棵子树进 orca.state.blocks，并回填 children（get-blocks-with-tags 常不带子树） */
async function dfLoadBlockTree(blockId) {
  var id = dfBlockId(blockId);
  if (!id) return null;
  var root = null;
  try {
    var tree = await orca.invokeBackend("get-block-tree", id);
    root = dfIngestBlockTree(tree) || null;
  } catch (e) {
    console.warn("[orca-diaryflow] get-block-tree failed", id, e);
  }
  if (!root) {
    try { delete orca.state.blocks[id]; } catch (e0) { /* ignore */ }
    root = await dfGetBlock(id);
  }
  return root;
}

/** 递归写入 state，统一 children 为 id 数组 */
function dfIngestBlockTree(node) {
  if (!node) return null;
  var id = dfBlockId(node.id != null ? node.id : node);
  if (!id) return null;
  var block = node;
  if (typeof node !== "object" || !node.id) {
    block = orca.state.blocks[id] || { id: id };
  }
  var childNodes = block.children || block.childBlocks || block.kids || [];
  var childIds = [];
  if (Array.isArray(childNodes)) {
    for (var i = 0; i < childNodes.length; i++) {
      var ch = childNodes[i];
      if (dfIsId(ch)) {
        childIds.push(ch);
        continue;
      }
      var ingested = dfIngestBlockTree(ch);
      if (ingested && dfIsId(ingested.id)) childIds.push(ingested.id);
    }
  }
  block.children = childIds;
  orca.state.blocks[id] = block;
  return block;
}

/** 把块树收成 markdown：对齐虎鲸大纲——子块一律作列表项，ul/ol/text 均可嵌套 */
async function dfAppendEntryMarkdown(block, depth, lines, opts) {
  opts = opts || {};
  if (!block) return;
  if (dfIsMediaBlock(block)) return;
  if (!opts.isRoot && dfHasTag(block, DF_TAG)) return;

  await dfPrefetchRefTargets(block);
  var tags = opts.isRoot ? (opts.rootTags || dfTagsOf(block)) : dfTagsOf(block);
  var md = dfBlockLineMarkdown(block, tags);
  var repr = dfBlockRepr(block);
  var type = repr.type || "text";
  var pad = "";
  for (var p = 0; p < depth; p++) pad += "  ";

  if (opts.isRoot) {
    // 条目首行：标题/正文，不加列表符
    if (md) lines.push(md);
  } else if (type === "ol") {
    lines.push(pad + String(opts.olIndex || 1) + ". " + (md || ""));
  } else if (type === "heading") {
    var level = Math.min(6, Math.max(1, Number(repr.level) || 1));
    var hashes = "";
    for (var h = 0; h < level; h++) hashes += "#";
    lines.push(hashes + " " + (md || ""));
  } else if (type === "quote" || type === "quote2") {
    lines.push("> " + (md || ""));
  } else if (type === "code") {
    lines.push("```");
    lines.push(md || "");
    lines.push("```");
  } else if (type === "ul" || type === "text" || md) {
    // 虎鲸默认大纲圆点：未显式转 ol 的子块都当无序列表项
    lines.push(pad + "- " + (md || ""));
  } else if (type && type !== "journal") {
    lines.push(pad + "〔" + String(type) + "〕");
  }

  var kids = await dfEnsureChildrenLoaded(block);
  // 无论父块是 text 还是 ul/ol，进入子级都加深一层（修复嵌套仍平铺）
  var childDepth = opts.isRoot ? 0 : depth + 1;
  var olIdx = 0;
  for (var i = 0; i < kids.length; i++) {
    var c = orca.state.blocks[kids[i]];
    if (!c || dfIsMediaBlock(c)) continue;
    if (dfHasTag(c, DF_TAG)) continue;
    var ct = dfBlockRepr(c).type || "text";
    var childOpts = { isRoot: false };
    if (ct === "ol") {
      olIdx += 1;
      childOpts.olIndex = olIdx;
    } else {
      olIdx = 0;
    }
    await dfAppendEntryMarkdown(c, childDepth, lines, childOpts);
  }
}

function dfSplitEntryLines(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(function (s) { return s.trimEnd(); })
    .filter(function (s, i, arr) {
      // 保留中间空行意义不大；首尾空行丢掉，全空则保留一行 ""
      return s.length > 0 || (arr.length === 1);
    });
}

/** 收集条目正文：首块 + 子树（含嵌套列表，不含图片） */
async function dfCollectEntryText(block) {
  if (!block) return "";
  var rooted = await dfLoadBlockTree(block.id);
  if (rooted) block = rooted;
  await dfPrefetchRefTargets(block);
  var lines = [];
  await dfAppendEntryMarkdown(block, 0, lines, { isRoot: true, rootTags: dfTagsOf(block) });
  return lines
    .filter(function (x, idx) { return x || idx === 0; })
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
}

/** 图片作为条目子块（lastChild），落在文字列表内 */
async function dfSyncImagesToBlock(blockId, images) {
  var id = dfBlockId(blockId);
  if (!id) return [];
  var list = (images || []).filter(Boolean).slice(0, 9);
  var orcaSrcs = [];
  for (var i = 0; i < list.length; i++) {
    var src = await dfSrcToOrcaAsset(list[i]);
    if (src) orcaSrcs.push(src);
  }

  await dfWithEditor(async function () {
    var oldIds = await dfListManagedMediaIds(id);
    if (oldIds.length) {
      try { await dfEditorCommand("core.editor.deleteBlocks", null, oldIds); } catch (e) { /* ignore */ }
    }
    var parent = orca.state.blocks[id] || { id: id };
    for (var j = 0; j < orcaSrcs.length; j++) {
      var src2 = orcaSrcs[j];
      var isVid = /\.(mp4|mov|webm|m4v|ogg|ogv)(\?|$)/i.test(src2) || /^data:video\//i.test(src2);
      var type = isVid ? "video" : "image";
      await dfEditorCommand(
        "core.editor.insertBlock",
        null,
        parent,
        "lastChild",
        [{ t: "t", v: type + ": " + src2 }],
        { type: type, src: src2 }
      );
    }
  });
  return orcaSrcs;
}

/**
 * 修正结构：#日记流 打在条目首行；其后同级文字/图片收进首行子级。
 * 兼容用户在日记页 Enter 拆行、图片插成同级的旧数据。
 */
async function dfHealEntryShape(block) {
  if (!block || !dfIsId(block.id) || !dfHasTag(block, DF_TAG)) return block;
  var parent = dfIsId(block.parent)
    ? (orca.state.blocks[block.parent] || await dfGetBlock(block.parent))
    : null;
  if (!parent || !Array.isArray(parent.children)) return block;

  var kids = parent.children.slice();
  var idx = kids.indexOf(block.id);
  if (idx < 0) return block;

  var start = idx;
  while (start > 0) {
    var prev = orca.state.blocks[kids[start - 1]] || await dfGetBlock(kids[start - 1]);
    if (!prev || dfHasTag(prev, DF_TAG) || dfIsMediaBlock(prev)) break;
    start--;
  }

  var rootId = kids[start];
  var nestIds = rootId === block.id ? [] : kids.slice(start + 1, idx + 1);

  var imageIds = [];
  for (var j = idx + 1; j < kids.length; j++) {
    var s = orca.state.blocks[kids[j]] || await dfGetBlock(kids[j]);
    if (!dfIsMediaBlock(s)) break;
    imageIds.push(kids[j]);
  }

  if (!nestIds.length && !imageIds.length) return block;

  var userTags = dfTagsOf(block);
  try {
    await dfWithEditor(async function () {
      if (rootId !== block.id) {
        try { await dfEditorCommand("core.editor.insertTag", null, rootId, DF_TAG); } catch (e0) { /* ignore */ }
        for (var t = 0; t < userTags.length; t++) {
          try { await dfEditorCommand("core.editor.insertTag", null, rootId, userTags[t]); } catch (e1) { /* ignore */ }
        }
        try { await dfEditorCommand("core.editor.removeTag", null, block.id, DF_TAG); } catch (e2) { /* ignore */ }
        for (var u = 0; u < userTags.length; u++) {
          try { await dfEditorCommand("core.editor.removeTag", null, block.id, userTags[u]); } catch (e3) { /* ignore */ }
        }
      }
      if (nestIds.length) {
        try {
          await dfEditorCommand("core.editor.moveBlocks", null, nestIds, rootId, "lastChild");
        } catch (e4) {
          console.warn("[orca-diaryflow] move text under root failed", e4);
        }
      }
      if (imageIds.length) {
        try {
          await dfEditorCommand("core.editor.moveBlocks", null, imageIds, rootId, "lastChild");
        } catch (e5) {
          console.warn("[orca-diaryflow] move images under root failed", e5);
        }
      }
    });
  } catch (e) {
    console.warn("[orca-diaryflow] heal entry shape failed", e);
    return block;
  }
  delete orca.state.blocks[rootId];
  return (await dfGetBlock(rootId)) || block;
}

/**
 * 子块自己打了 #日记流：提到父条目之后（同级），避免被当成正文子块藏掉。
 */
async function dfPromoteDiaryChild(block, parent) {
  if (!block || !dfIsId(block.id) || !parent || !dfIsId(parent.id)) return block;
  if (!dfHasTag(block, DF_TAG) || !dfHasTag(parent, DF_TAG)) return block;
  if (block.parent !== parent.id) return block;
  try {
    await dfWithEditor(async function () {
      await dfEditorCommand("core.editor.moveBlocks", null, [block.id], parent.id, "after");
    });
  } catch (e) {
    console.warn("[orca-diaryflow] promote diary child failed", block.id, e);
    return block;
  }
  try { delete orca.state.blocks[block.id]; } catch (e0) { /* ignore */ }
  try { delete orca.state.blocks[parent.id]; } catch (e1) { /* ignore */ }
  return (await dfGetBlock(block.id)) || block;
}

async function dfBlockToFeedItem(block, overlay) {
  if (!block || !dfIsId(block.id)) return null;
  overlay = overlay || {};
  var created = block.created instanceof Date ? block.created : new Date(block.created || Date.now());
  // 日期以所属日记页为准；overlay.createdAt 仅在「与日记页同一天」时保留时分
  // （避免 save 把「写入当天」写进 overlay 后永远盖住日记页日期）
  var jd = await dfJournalDateOfBlock(block);
  var ovt = null;
  if (overlay.createdAt) {
    ovt = new Date(Number(overlay.createdAt));
    if (isNaN(ovt.getTime())) ovt = null;
  }
  if (jd) {
    created = jd;
    if (ovt && dfSameLocalDay(ovt, jd)) created = ovt;
  } else if (ovt) {
    created = ovt;
  }
  var tags = dfTagsOf(block);
  var text = await dfCollectEntryText(block);
  text = dfStripInlineTagText(text, tags);
  var fromBlock = (await dfCollectImageSrcs(block)).map(dfResolveOrcaAssetSrc).filter(dfIsDisplayableImgSrc);
  var fromOverlay = (Array.isArray(overlay.images) ? overlay.images : [])
    .filter(Boolean)
    .map(dfResolveOrcaAssetSrc)
    .filter(function (s) { return dfIsDisplayableImgSrc(s) || String(s).indexOf("dfasset:") === 0; })
    .slice(0, 99);
  var images = fromBlock.length ? fromBlock : fromOverlay;
  var refs = dfOutgoingRefs(block);
  return {
    id: String(block.id),
    blockId: block.id,
    text: text,
    images: images,
    link: "",
    linkTitle: "",
    created: dfFmtCreated(created),
    createdAt: created.getTime(),
    liked: !!(overlay.liked || dfProp(block, "df.liked")),
    comments: Array.isArray(overlay.comments) ? overlay.comments : [],
    pinned: !!(overlay.pinned || dfProp(block, "df.pinned")),
    location: dfResolveLocation(block, overlay),
    tags: tags,
    refs: refs
  };
}

function dfResolveLocation(block, overlay) {
  var fromProp = dfProp(block, DF_LOC_PROP);
  if (fromProp != null && String(fromProp).trim()) return String(fromProp).trim();
  var fromOv = overlay && overlay.location;
  if (fromOv != null && String(fromOv).trim()) return String(fromOv).trim();
  return "";
}

/** 属性与 overlay 对齐：有属性则回写 overlay，避免双源漂移 */
async function dfSyncLocationOverlay(block, index) {
  if (!block || !dfIsId(block.id) || !index) return;
  var key = String(block.id);
  var fromProp = dfProp(block, DF_LOC_PROP);
  var propLoc = fromProp != null ? String(fromProp).trim() : "";
  var ov = index.overlays[key] || {};
  var ovLoc = ov.location != null ? String(ov.location).trim() : "";
  if (propLoc === ovLoc) return;
  if (!propLoc && !ovLoc) return;
  // 属性优先：有属性用属性；属性空但 overlay 有则保留 overlay（稍后 update 会双写）
  if (!propLoc) return;
  index.overlays[key] = Object.assign({}, ov, { location: propLoc });
  try { await dfSaveIndex(index); } catch (e) { /* ignore */ }
}

async function dfLoadIndex() {
  try {
    var v = await orca.plugins.getData(orcaPluginName, DF_INDEX_KEY);
    if (v == null) return { overlays: {}, config: null };
    if (typeof v === "string") {
      try { v = JSON.parse(v); } catch (e) { return { overlays: {}, config: null }; }
    }
    return {
      overlays: (v && v.overlays) || {},
      config: (v && v.config) || null,
      migratedFromMoments: !!(v && v.migratedFromMoments)
    };
  } catch (e) {
    return { overlays: {}, config: null };
  }
}

async function dfSaveIndex(idx) {
  await orca.plugins.setData(orcaPluginName, DF_INDEX_KEY, JSON.stringify(idx || { overlays: {} }));
}

/** 搜索命中 ID → 日记流根块 ID（含子块命中向上找父） */
async function dfExpandSearchHitsToFeedRoots(hitIds, feedBlocks) {
  var feedIds = new Set();
  (feedBlocks || []).forEach(function (b) {
    if (b && dfIsId(b.id)) feedIds.add(b.id);
  });
  var matched = new Set();
  if (!hitIds || !hitIds.size || !feedIds.size) return matched;

  var hits = Array.from(hitIds);
  // 先批量拉命中块，减少逐个 get-block
  var need = hits.filter(function (id) { return !(orca.state.blocks && orca.state.blocks[id]); });
  if (need.length) {
    try {
      var got = await orca.invokeBackend("get-blocks", need);
      if (Array.isArray(got)) got.forEach(function (b) { if (b && b.id) orca.state.blocks[b.id] = b; });
    } catch (e) { /* ignore */ }
  }

  for (var i = 0; i < hits.length; i++) {
    var curId = hits[i];
    for (var g = 0; g < 24; g++) {
      if (!dfIsId(curId)) break;
      if (feedIds.has(curId)) {
        matched.add(curId);
        break;
      }
      var cur = orca.state.blocks[curId] || await dfGetBlock(curId);
      if (!cur || !dfIsId(cur.parent)) break;
      curId = cur.parent;
    }
  }
  return matched;
}

/** 本地关键词匹配用：根块正文 + 标签 + 地点 + 非媒体子块正文 */
async function dfEntrySearchBlob(block) {
  if (!block) return "";
  var parts = [String(block.text || ""), dfTagsOf(block).join(" ")];
  var loc = dfProp(block, DF_LOC_PROP);
  if (loc) parts.push(String(loc));
  var kids = block.children || [];
  if (kids.length) {
    var need = kids.filter(function (id) { return !(orca.state.blocks && orca.state.blocks[id]); });
    if (need.length) {
      try {
        var got = await orca.invokeBackend("get-blocks", need);
        if (Array.isArray(got)) got.forEach(function (b) { if (b && b.id) orca.state.blocks[b.id] = b; });
      } catch (e) { /* ignore */ }
    }
    for (var i = 0; i < kids.length; i++) {
      var c = orca.state.blocks[kids[i]];
      if (!c || dfIsMediaBlock(c)) continue;
      if (dfHasTag(c, DF_TAG)) continue; // 独立条目不并入父搜索
      parts.push(String(c.text || ""));
    }
  }
  return parts.join(" ").toLowerCase();
}

async function listFeed(opts) {
  opts = opts || {};
  var kw = String(opts.kw || "").trim();
  var tagFilter = Array.isArray(opts.tags) ? opts.tags.filter(Boolean) : [];
  if (kw.startsWith("#")) {
    var tOnly = kw.slice(1).trim();
    if (tOnly && tagFilter.indexOf(tOnly) < 0) tagFilter.push(tOnly);
    kw = "";
  }

  var blocks = [];
  try {
    // 只查固定标签，用户标签在本地 AND 过滤（避免多标签 API 语义差异）
    blocks = (await orca.invokeBackend("get-blocks-with-tags", [DF_TAG])) || [];
  } catch (e) {
    console.warn("[orca-diaryflow] get-blocks-with-tags failed", e);
    blocks = [];
  }
  if (!Array.isArray(blocks)) blocks = [];

  if (tagFilter.length) {
    blocks = blocks.filter(function (b) {
      return tagFilter.every(function (t) { return dfHasTag(b, t); });
    });
  }

  if (kw) {
    var kwLower = kw.toLowerCase();
    var hitIds = null;
    try {
      var searched = await orca.invokeBackend("search-blocks-by-text", kw);
      // API 可能返回 [blocks, aliases] 或 blocks 数组
      var list = Array.isArray(searched) ? (Array.isArray(searched[0]) ? searched[0].concat(searched[1] || []) : searched) : [];
      hitIds = new Set();
      list.forEach(function (x) {
        var id = dfBlockId(x) || (x && x.type === "block" && x.id);
        if (dfIsId(id)) hitIds.add(id);
        else if (x && dfIsId(x.id)) hitIds.add(x.id);
      });
    } catch (e2) {
      hitIds = null;
    }
    // 命中子块时向上归并到带 #日记流 的父条目
    var matchedRoots = null;
    if (hitIds && hitIds.size) {
      matchedRoots = await dfExpandSearchHitsToFeedRoots(hitIds, blocks);
    }
    var kept = [];
    for (var bi = 0; bi < blocks.length; bi++) {
      var bb = blocks[bi];
      if (!bb || !dfIsId(bb.id)) continue;
      if (matchedRoots && matchedRoots.has(bb.id)) {
        kept.push(bb);
        continue;
      }
      // 全文搜索无命中 / 归并后仍空：回退本地（根块 + 子块正文 + 地点）
      if (!matchedRoots || !matchedRoots.size) {
        var blob = await dfEntrySearchBlob(bb);
        if (blob.indexOf(kwLower) >= 0) kept.push(bb);
      }
    }
    blocks = kept;
  }

  var index = await dfLoadIndex();
  var items = [];
  var skipHeal = !!opts.skipHeal;
  var preferLive = opts.preferLive === true;
  var freezeState = !!opts.freezeState;
  for (var i = 0; i < blocks.length; i++) {
    var b = blocks[i];
    // 后台同步时优先用内存中的实时块，避免用后端快照盖掉正在编辑的内容（编辑器跳动）
    if (preferLive && b && b.id && orca.state.blocks[b.id]) {
      b = orca.state.blocks[b.id];
    } else if (b && b.id && !freezeState) {
      orca.state.blocks[b.id] = b;
    }
    if (!skipHeal) {
      try { b = await dfHealPlainTagText(b); } catch (eHeal) { /* ignore */ }
      if (b && b.id) orca.state.blocks[b.id] = b;
      var beforeId = b && b.id;
      try { b = await dfHealEntryShape(b); } catch (eShape) { /* ignore */ }
      if (b && b.id) orca.state.blocks[b.id] = b;
      // 标签从末行迁到首行后，overlay 跟着迁
      if (b && beforeId && b.id !== beforeId) {
        var oldOv = index.overlays[String(beforeId)];
        if (oldOv) {
          index.overlays[String(b.id)] = Object.assign({}, index.overlays[String(b.id)] || {}, oldOv);
          delete index.overlays[String(beforeId)];
          try { await dfSaveIndex(index); } catch (eOv) { /* ignore */ }
        }
      }
    }
    // 父条目下的普通子块（无独立 #日记流）不单独成卡；子块自己打了标签则展示（并尽量提升为同级）
    if (b && dfIsId(b.parent)) {
      var p = orca.state.blocks[b.parent] || await dfGetBlock(b.parent);
      if (p && dfHasTag(p, DF_TAG) && p.id !== b.id) {
        if (dfHasTag(b, DF_TAG)) {
          if (!skipHeal) {
            try { b = await dfPromoteDiaryChild(b, p); } catch (eProm) { /* ignore */ }
          }
        } else {
          continue;
        }
      }
    }
    if (!skipHeal) {
      try {
        var ov = index.overlays[String(b.id)] || {};
        if (!ov.imagesPushedToOrca && ov.images && ov.images.length) {
          var haveImg = await dfCollectImageSrcs(b);
          if (!haveImg.length) {
            var pushed = await dfSyncImagesToBlock(b.id, ov.images);
            if (pushed && pushed.length) {
              await setOverlay(b.id, { images: pushed, imagesPushedToOrca: true });
              index.overlays[String(b.id)] = Object.assign({}, index.overlays[String(b.id)] || {}, {
                images: pushed,
                imagesPushedToOrca: true
              });
              delete orca.state.blocks[b.id];
              b = (await dfGetBlock(b.id)) || b;
            }
          } else {
            await setOverlay(b.id, { imagesPushedToOrca: true });
            index.overlays[String(b.id)] = Object.assign({}, index.overlays[String(b.id)] || {}, {
              imagesPushedToOrca: true
            });
          }
        }
      } catch (eImgHeal) { /* ignore */ }
    }
    if (!skipHeal) {
      try { await dfSyncLocationOverlay(b, index); } catch (eLoc) { /* ignore */ }
    }
    if (b && b.id && !preferLive && !freezeState) orca.state.blocks[b.id] = b;
    var item = await dfBlockToFeedItem(b, index.overlays[String(b.id)]);
    if (item) {
      items.push(item);
      // 清掉与日记页不同日的误写 createdAt（常见于批量写入后 save 把「今天」落盘）
      if (!skipHeal && b && b.id) {
        var ovFix = index.overlays[String(b.id)];
        if (ovFix && ovFix.createdAt) {
          var jdFix = await dfJournalDateOfBlock(b);
          var ovDate = new Date(Number(ovFix.createdAt));
          if (jdFix && !isNaN(ovDate.getTime()) && !dfSameLocalDay(ovDate, jdFix)) {
            delete ovFix.createdAt;
            index.overlays[String(b.id)] = ovFix;
            index.__dfCreatedAtHealed = true;
          }
        }
      }
    }
  }
  if (index.__dfCreatedAtHealed) {
    try {
      delete index.__dfCreatedAtHealed;
      await dfSaveIndex(index);
    } catch (eHealSave) { /* ignore */ }
  }
  items.sort(function (a, b) {
    if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  return { items: items, index: index };
}

function dfSleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function dfWalkPanels(root, fn) {
  if (!root || typeof root !== "object") return null;
  var hit = fn(root);
  if (hit) return hit;
  if (Array.isArray(root.children)) {
    for (var i = 0; i < root.children.length; i++) {
      var r = dfWalkPanels(root.children[i], fn);
      if (r) return r;
    }
  }
  return null;
}

function dfFindEditorPanelId() {
  return dfWalkPanels(orca.state.panels, function (node) {
    if (node && node.id && node.viewState && node.viewState.editor) return node.id;
    return null;
  });
}

/** 日记流面板没有 BlockEditor；orca.commands.invokeGroup 依赖 activePanel.viewState.editor，否则会崩 */
async function dfWithEditor(fn, dateHint, opts) {
  opts = opts || {};
  var prev = orca.state.activePanel;
  var editorPanel = dfFindEditorPanelId();
  try {
    if (!editorPanel) {
      var d = dateHint instanceof Date ? dateHint : new Date();
      try {
        orca.nav.openInLastPanel("journal", { date: d });
      } catch (e) {
        try { orca.nav.goTo("journal", { date: d }); } catch (e2) { /* ignore */ }
      }
      await dfSleep(150);
      editorPanel = dfFindEditorPanelId();
    }
    if (editorPanel) {
      try { orca.nav.switchFocusTo(editorPanel); } catch (e) { /* ignore */ }
      await dfSleep(60);
    }
    var panel = orca.nav.findViewPanel(orca.state.activePanel, orca.state.panels);
    var ed = panel && panel.viewState && panel.viewState.editor;
    if (ed && typeof ed.invokeGroup === "function") {
      await ed.invokeGroup(fn, { topGroup: true });
    } else if (orca.commands && typeof orca.commands.invokeGroup === "function" && ed) {
      // 仅当已有 editor 时走 orca.commands，避免 viewState.editor 为 undefined 时官方实现抛错
      await orca.commands.invokeGroup(fn, { topGroup: true });
    } else if (ed && typeof ed.invokeCommand === "function") {
      await fn();
    } else {
      throw new Error("当前没有可用的块编辑器，请先打开任意日记或笔记面板后再试");
    }
  } finally {
    // keepFocus：新建后要接着在虎鲸里打字，不要抢回日记流面板
    if (prev && !opts.keepFocus) {
      try { orca.nav.switchFocusTo(prev); } catch (e) { /* ignore */ }
    }
  }
}

async function dfEditorCommand(id, cursor) {
  var args = Array.prototype.slice.call(arguments, 2);
  var panel = orca.nav.findViewPanel(orca.state.activePanel, orca.state.panels);
  var ed = panel && panel.viewState && panel.viewState.editor;
  if (ed && typeof ed.invokeCommand === "function") {
    return ed.invokeCommand.apply(ed, [id, cursor].concat(args));
  }
  if (orca.commands && typeof orca.commands.invokeEditorCommand === "function") {
    return orca.commands.invokeEditorCommand.apply(orca.commands, [id, cursor].concat(args));
  }
  throw new Error("invokeEditorCommand 不可用");
}

async function createEntry(opts) {
  opts = opts || {};
  var date = opts.date instanceof Date ? opts.date : new Date(opts.date || Date.now());
  var extraTags = opts.tags || [];
  var text = dfStripInlineTagText(opts.text != null ? String(opts.text) : "", extraTags);
  var lines = dfSplitEntryLines(text);
  if (!lines.length) lines = [""];
  var journal = await dfEnsureJournal(date);
  var newId = null;
  var keepFocus = !!(opts.focusBeforeTags || opts.keepEditorFocus);
  await dfWithEditor(async function () {
    // 首行：打 #日记流 + 用户标签；空正文传 null，让虎鲸按「仅标签」结构渲染（标签前可打字）
    var firstContent = lines[0] ? dfMarkdownLineToFragments(lines[0]) : null;
    newId = await dfEditorCommand(
      "core.editor.insertBlock",
      null,
      orca.state.blocks[journal.id] || journal,
      "lastChild",
      firstContent,
      { type: "text" }
    );
    if (!dfIsId(newId)) throw new Error("insertBlock 未返回有效 ID（得到 " + String(newId) + "）");
    await dfEditorCommand("core.editor.insertTag", null, newId, DF_TAG);
    for (var i = 0; i < extraTags.length; i++) {
      var t = String(extraTags[i] || "").replace(/^#/, "").trim();
      if (t && t !== DF_TAG) {
        try { await dfEditorCommand("core.editor.insertTag", null, newId, t); } catch (e) { /* ignore */ }
      }
    }
    // 其余行：作为首行子块，图片也挂在同一棵树上
    var root = orca.state.blocks[newId] || { id: newId };
    for (var li = 1; li < lines.length; li++) {
      await dfEditorCommand(
        "core.editor.insertBlock",
        null,
        root,
        "lastChild",
        dfMarkdownLineToFragments(lines[li]),
        { type: "text" }
      );
    }
  }, date, { keepFocus: keepFocus });

  var orcaImgs = [];
  if (opts.images && opts.images.length) {
    try { orcaImgs = await dfSyncImagesToBlock(newId, opts.images); } catch (eImg) {
      console.warn("[orca-diaryflow] sync images on create failed", eImg);
    }
  }

  if (opts.location || orcaImgs.length || (opts.images && opts.images.length) || opts.liked || opts.pinned || opts.comments) {
    await setOverlay(newId, {
      location: opts.location || "",
      images: orcaImgs.length ? orcaImgs : (Array.isArray(opts.images) ? opts.images.slice(0, 9) : []),
      imagesPushedToOrca: orcaImgs.length > 0,
      liked: !!opts.liked,
      pinned: !!opts.pinned,
      comments: Array.isArray(opts.comments) ? opts.comments : []
    });
  }
  if (opts.location && String(opts.location).trim()) {
    try {
      await dfWithEditor(async function () {
        await dfEditorCommand("core.editor.setProperties", null, [newId], [
          { name: DF_LOC_PROP, type: DF_PROP_TEXT, value: String(opts.location).trim() }
        ]);
      }, date, { keepFocus: keepFocus });
    } catch (eLoc) {
      console.warn("[orca-diaryflow] set location prop on create failed", eLoc);
    }
  }
  var block = await dfGetBlock(newId);
  return block || { id: newId };
}

/** 轻量编辑：首行更新 + 其余行同步为子块；图片挂在条目下 */
async function updateEntry(blockId, payload) {
  var id = dfBlockId(blockId);
  if (!id) throw new Error("无效 blockId");
  payload = payload || {};
  var wantTags = (payload.tags || []).map(function (t) {
    return String(t || "").replace(/^#/, "").trim();
  }).filter(function (t) { return t && t !== DF_TAG; });
  var text = dfStripInlineTagText(payload.text != null ? String(payload.text) : "", wantTags);
  var lines = dfSplitEntryLines(text);
  if (!lines.length) lines = [""];

  await dfWithEditor(async function () {
    await dfEditorCommand("core.editor.setBlocksContent", null, [{
      id: id,
      content: lines[0] ? dfMarkdownLineToFragments(lines[0]) : [{ t: "t", v: "" }]
    }], false);

    var block = await dfGetBlock(id);
    var kids = (block && block.children) || [];
    var textChildIds = [];
    for (var ci = 0; ci < kids.length; ci++) {
      var ch = orca.state.blocks[kids[ci]] || await dfGetBlock(kids[ci]);
      if (ch && !dfIsMediaBlock(ch)) textChildIds.push(ch.id);
    }
    if (textChildIds.length) {
      try { await dfEditorCommand("core.editor.deleteBlocks", null, textChildIds); } catch (eDel) { /* ignore */ }
    }
    var root = orca.state.blocks[id] || { id: id };
    for (var li = 1; li < lines.length; li++) {
      await dfEditorCommand(
        "core.editor.insertBlock",
        null,
        root,
        "lastChild",
        dfMarkdownLineToFragments(lines[li]),
        { type: "text" }
      );
    }

    try { await dfEditorCommand("core.editor.insertTag", null, id, DF_TAG); } catch (eTag) { /* ignore */ }
    var have = {};
    dfTagsOf((await dfGetBlock(id)) || {}).forEach(function (t) { have[t] = true; });
    for (var i = 0; i < wantTags.length; i++) {
      if (!have[wantTags[i]]) {
        try { await dfEditorCommand("core.editor.insertTag", null, id, wantTags[i]); } catch (e) { /* ignore */ }
      }
    }
  });

  var orcaImgs = [];
  if (payload.images !== undefined) {
    try { orcaImgs = await dfSyncImagesToBlock(id, payload.images || []); } catch (eImg) {
      console.warn("[orca-diaryflow] sync images on update failed", eImg);
      orcaImgs = Array.isArray(payload.images) ? payload.images.filter(Boolean).slice(0, 9) : [];
    }
  }

  var patch = {
    location: payload.location || ""
  };
  if (payload.images !== undefined) {
    patch.images = orcaImgs.length ? orcaImgs : (Array.isArray(payload.images) ? payload.images.filter(Boolean).slice(0, 9) : []);
    patch.imagesPushedToOrca = orcaImgs.length > 0 || !(payload.images && payload.images.length);
  }
  if (payload.liked !== undefined) patch.liked = !!payload.liked;
  if (payload.pinned !== undefined) patch.pinned = !!payload.pinned;
  if (payload.comments !== undefined) {
    patch.comments = Array.isArray(payload.comments) ? payload.comments : [];
  }
  await setOverlay(id, patch);
  return dfGetBlock(id);
}

async function deleteEntry(blockId) {
  var id = dfBlockId(blockId);
  if (!id) return false;
  await dfWithEditor(async function () {
    await dfEditorCommand("core.editor.deleteBlocks", null, [id]);
  });
  var index = await dfLoadIndex();
  if (index.overlays[String(id)]) {
    delete index.overlays[String(id)];
    await dfSaveIndex(index);
  }
  return true;
}

async function setOverlay(blockId, patch) {
  var id = String(dfBlockId(blockId) || blockId);
  var index = await dfLoadIndex();
  var next = Object.assign({}, index.overlays[id] || {}, patch || {});
  Object.keys(patch || {}).forEach(function (k) {
    if (patch[k] == null) delete next[k];
  });
  index.overlays[id] = next;
  await dfSaveIndex(index);
  return index.overlays[id];
}

/**
 * 修改条目时间：
 * - overlay.createdAt：日记流展示/排序（虎鲸无公开 API 改 block.created）
 * - 若日期天变化：把块移到对应日记页（虎鲸侧「属于哪一天」）
 */
async function updateEntryTime(blockId, date) {
  var id = dfBlockId(blockId);
  if (!id) throw new Error("无效 blockId");
  var d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) throw new Error("无效时间");

  await setOverlay(id, { createdAt: d.getTime() });

  var journal = await dfEnsureJournal(d);
  var block = await dfGetBlock(id);
  var moved = false;
  if (block && dfIsId(journal.id) && block.parent !== journal.id) {
    await dfWithEditor(async function () {
      await dfEditorCommand("core.editor.moveBlocks", null, [id], journal.id, "lastChild");
    }, d);
    moved = true;
    try { delete orca.state.blocks[id]; } catch (e0) { /* ignore */ }
    block = (await dfGetBlock(id)) || block;
  }
  return { block: block, moved: moved, createdAt: d.getTime() };
}

/** 地点：双写 overlay + 块属性 df.location，并写入正文末行「地点：XXX」 */
async function updateEntryLocation(blockId, location) {
  var id = dfBlockId(blockId);
  if (!id) throw new Error("无效 blockId");
  var loc = String(location == null ? "" : location).trim();

  await setOverlay(id, { location: loc });

  var block0 = await dfGetBlock(id);
  var tags = dfNormalizeUserTags(dfTagsOf(block0 || {}));
  var text = await dfCollectEntryText(block0 || { id: id });
  text = dfStripInlineTagText(text, tags.concat([DF_TAG]));
  var lines = dfSplitEntryLines(text);
  while (lines.length) {
    var last = String(lines[lines.length - 1] || "").trim();
    if (/^地点\s*[:：]/.test(last) || /^📍\s*/.test(last)) lines.pop();
    else break;
  }
  if (loc) lines.push("地点：" + loc);
  if (!lines.length) lines = [""];

  await dfWithEditor(async function () {
    if (loc) {
      await dfEditorCommand("core.editor.setProperties", null, [id], [
        { name: DF_LOC_PROP, type: DF_PROP_TEXT, value: loc }
      ]);
    } else {
      try {
        await dfEditorCommand("core.editor.deleteProperties", null, [id], [DF_LOC_PROP]);
      } catch (eDel) {
        // 属性本就不存在时忽略
      }
    }

    await dfEditorCommand("core.editor.setBlocksContent", null, [{
      id: id,
      content: lines[0] ? dfMarkdownLineToFragments(lines[0]) : [{ t: "t", v: "" }]
    }], false);

    var block = await dfGetBlock(id);
    var kids = (block && block.children) || [];
    var textChildIds = [];
    for (var ci = 0; ci < kids.length; ci++) {
      var ch = orca.state.blocks[kids[ci]] || await dfGetBlock(kids[ci]);
      if (ch && !dfIsMediaBlock(ch)) textChildIds.push(ch.id);
    }
    if (textChildIds.length) {
      try { await dfEditorCommand("core.editor.deleteBlocks", null, textChildIds); } catch (eDel2) { /* ignore */ }
    }
    var root = orca.state.blocks[id] || { id: id };
    for (var li = 1; li < lines.length; li++) {
      await dfEditorCommand(
        "core.editor.insertBlock",
        null,
        root,
        "lastChild",
        dfMarkdownLineToFragments(lines[li]),
        { type: "text" }
      );
    }
    try { await dfEditorCommand("core.editor.insertTag", null, id, DF_TAG); } catch (eTag) { /* ignore */ }
    for (var ti = 0; ti < tags.length; ti++) {
      try { await dfEditorCommand("core.editor.insertTag", null, id, tags[ti]); } catch (eT) { /* ignore */ }
    }
  });

  try { delete orca.state.blocks[id]; } catch (e0) { /* ignore */ }
  var block = await dfGetBlock(id);
  return { block: block, location: loc };
}

function dfNormalizeUserTags(tags) {
  var out = [];
  var seen = {};
  (Array.isArray(tags) ? tags : []).forEach(function (t) {
    t = String(t || "").replace(/^#/, "").trim();
    if (!t || t === DF_TAG || seen[t]) return;
    seen[t] = true;
    out.push(t);
  });
  return out;
}

/** 用户标签写入虎鲸（不含固定 #日记流） */
async function updateEntryTags(blockId, tags) {
  var id = dfBlockId(blockId);
  if (!id) throw new Error("无效 blockId");
  var want = dfNormalizeUserTags(tags);
  var block = await dfGetBlock(id);
  if (!block) throw new Error("块不存在");
  var have = dfNormalizeUserTags(dfTagsOf(block));
  var haveSet = {};
  have.forEach(function (t) { haveSet[t] = true; });
  var wantSet = {};
  want.forEach(function (t) { wantSet[t] = true; });
  var toAdd = want.filter(function (t) { return !haveSet[t]; });
  var toRemove = have.filter(function (t) { return !wantSet[t]; });

  if (toAdd.length || toRemove.length) {
    await dfWithEditor(async function () {
      // 确保入流标签仍在
      try { await dfEditorCommand("core.editor.insertTag", null, id, DF_TAG); } catch (e0) { /* ignore */ }
      for (var i = 0; i < toRemove.length; i++) {
        try { await dfEditorCommand("core.editor.removeTag", null, id, toRemove[i]); } catch (e1) { /* ignore */ }
      }
      for (var j = 0; j < toAdd.length; j++) {
        try { await dfEditorCommand("core.editor.insertTag", null, id, toAdd[j]); } catch (e2) { /* ignore */ }
      }
    });
    try { delete orca.state.blocks[id]; } catch (e3) { /* ignore */ }
    block = (await dfGetBlock(id)) || block;
  }
  return { block: block, tags: dfNormalizeUserTags(dfTagsOf(block)) };
}

async function collectUserTags() {
  var feed = await listFeed({});
  var set = new Set();
  feed.items.forEach(function (it) {
    (it.tags || []).forEach(function (t) { if (t) set.add(t); });
  });
  return Array.from(set).sort();
}

/** 找到包含某块的面板 id */
function dfFindPanelIdForBlock(blockId) {
  var id = dfBlockId(blockId);
  if (!id) return null;
  var el = document.querySelector('.orca-block[data-id="' + id + '"]');
  if (!el) return null;
  var panelEl = el.closest(".orca-panel[data-panel-id]");
  return panelEl ? panelEl.getAttribute("data-panel-id") : null;
}

/**
 * 把光标钉在 .orca-tags 正前方（可直接打字）。
 * 会多次重试，避免被虎鲸面板 mount 时的 focusAndPlaceCursor 盖掉。
 */
function dfPlaceCaretBeforeTagsDom(blockId) {
  var id = dfBlockId(blockId);
  if (!id) return false;
  var blockEl = document.querySelector('.orca-block[data-id="' + id + '"]');
  if (!blockEl) return false;
  var content = blockEl.querySelector(
    ".orca-repr > .orca-repr-main .orca-repr-main-content:not([contenteditable='false'])"
  );
  if (!content) {
    content = blockEl.querySelector(".orca-repr-main-content");
  }
  if (!content) return false;
  try {
    blockEl.scrollIntoView({ block: "nearest" });
  } catch (eSc) { /* ignore */ }
  var sel = document.getSelection();
  if (!sel) return false;
  try {
    if (typeof content.focus === "function") content.focus({ preventScroll: true });
  } catch (eF) { /* ignore */ }
  var tags = null;
  try {
    tags = content.querySelector(":scope > .orca-tags");
  } catch (eQ) {
    var kids = content.children || [];
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].classList && kids[i].classList.contains("orca-tags")) {
        tags = kids[i];
        break;
      }
    }
  }
  try {
    if (tags) {
      var idx = Array.prototype.indexOf.call(content.children, tags);
      if (idx < 0) idx = Array.prototype.indexOf.call(content.childNodes, tags);
      if (idx < 0) return false;
      sel.setPosition(content, idx);
    } else {
      // 尚无标签时：落在首个可编辑 inline 开头
      var inline = null;
      try { inline = content.querySelector(":scope > .orca-inline"); } catch (eI) {
        inline = content.querySelector(".orca-inline");
      }
      if (inline && inline.firstChild) sel.setPosition(inline.firstChild, 0);
      else sel.setPosition(content, 0);
    }
    return true;
  } catch (eSet) {
    return false;
  }
}

async function dfFocusCursorBeforeTags(blockId) {
  var id = dfBlockId(blockId);
  if (!id) return false;
  var ok = false;
  var delays = [0, 30, 80, 150, 250, 400, 600, 900, 1200, 1600];
  for (var i = 0; i < delays.length; i++) {
    if (delays[i]) await dfSleep(delays[i] - (i ? delays[i - 1] : 0));
    var panelId = dfFindPanelIdForBlock(id) || (orca.state && orca.state.activePanel);
    if (panelId) {
      try { orca.nav.switchFocusTo(panelId); } catch (eSw) { /* ignore */ }
    }
    if (dfPlaceCaretBeforeTagsDom(id)) ok = true;
  }
  return ok;
}

async function openEntry(blockId, panelId, opts) {
  var id = dfBlockId(blockId);
  if (!id) return false;
  opts = opts || {};
  var opened = false;
  var dateHint = opts.date instanceof Date ? opts.date : (opts.date ? new Date(opts.date) : null);
  try {
    if (opts.cursorBeforeTags && dateHint && !isNaN(dateHint.getTime())) {
      // 新建：打开当日日记大纲（与用户期望的列表结构一致），再钉光标
      if (panelId) {
        orca.nav.goTo("journal", { date: dateHint }, panelId);
      } else {
        orca.nav.openInLastPanel("journal", { date: dateHint });
      }
    } else if (panelId) {
      orca.nav.goTo("block", { blockId: id }, panelId);
    } else {
      orca.nav.openInLastPanel("block", { blockId: id });
    }
    opened = true;
  } catch (e) {
    console.warn("[orca-diaryflow] openEntry failed", e);
    try {
      if (opts.cursorBeforeTags && dateHint && !isNaN(dateHint.getTime())) {
        orca.nav.openInLastPanel("journal", { date: dateHint });
      } else {
        orca.nav.openInLastPanel("block", { blockId: id });
      }
      opened = true;
    } catch (e2) {
      return false;
    }
  }
  if (opened && opts.cursorBeforeTags) {
    try { await dfFocusCursorBeforeTags(id); } catch (eCur) {
      console.warn("[orca-diaryflow] focus before tags failed", eCur);
    }
  }
  return opened;
}

async function migrateMomentsRecords(loadLegacyFn) {
  var flag = await orca.plugins.getData(orcaPluginName, DF_MIGRATED_KEY);
  if (flag === true || flag === "true" || flag === 1) {
    return { skipped: true, count: 0 };
  }
  var legacy = null;
  try {
    legacy = typeof loadLegacyFn === "function" ? await loadLegacyFn() : null;
  } catch (e) {
    legacy = null;
  }
  if (!legacy || !Array.isArray(legacy.items) || !legacy.items.length) {
    await orca.plugins.setData(orcaPluginName, DF_MIGRATED_KEY, "true");
    var emptyIdx = await dfLoadIndex();
    if (legacy && legacy.config) emptyIdx.config = legacy.config;
    emptyIdx.migratedFromMoments = true;
    await dfSaveIndex(emptyIdx);
    return { skipped: true, count: 0 };
  }

  try {
    await orca.plugins.setData(orcaPluginName, DF_BACKUP_KEY, JSON.stringify(legacy));
  } catch (e) {
    console.warn("[orca-diaryflow] backup moments-records failed", e);
  }

  var index = await dfLoadIndex();
  if (legacy.config) index.config = legacy.config;
  var count = 0;
  for (var i = 0; i < legacy.items.length; i++) {
    var it = legacy.items[i];
    if (!it) continue;
    try {
      var date = it.createdAt ? new Date(it.createdAt) : new Date(String(it.created || "").replace(" ", "T"));
      if (isNaN(date.getTime())) date = new Date();
      var text = it.text || "";
      if (it.location) text = text + (text ? "\n" : "") + "📍 " + it.location;
      if (Array.isArray(it.images) && it.images.length) {
        text = text + (text ? "\n" : "") + it.images.map(function (s) { return String(s); }).join("\n");
      }
      var block = await createEntry({ date: date, text: text, tags: it.tags || [] });
      var bid = dfBlockId(block);
      if (bid) {
        index.overlays[String(bid)] = {
          liked: !!it.liked,
          pinned: !!it.pinned,
          comments: Array.isArray(it.comments) ? it.comments : [],
          location: it.location || "",
          legacyId: it.id
        };
        count++;
      }
    } catch (e2) {
      console.warn("[orca-diaryflow] migrate item failed", it && it.id, e2);
    }
  }
  index.migratedFromMoments = true;
  await dfSaveIndex(index);
  await orca.plugins.setData(orcaPluginName, DF_MIGRATED_KEY, "true");
  return { skipped: false, count: count };
}

var OrcaBlocks = {
  TAG: DF_TAG,
  INDEX_KEY: DF_INDEX_KEY,
  listFeed: listFeed,
  createEntry: createEntry,
  updateEntry: updateEntry,
  updateEntryTime: updateEntryTime,
  updateEntryLocation: updateEntryLocation,
  updateEntryTags: updateEntryTags,
  deleteEntry: deleteEntry,
  setOverlay: setOverlay,
  collectUserTags: collectUserTags,
  openEntry: openEntry,
  migrateMomentsRecords: migrateMomentsRecords,
  loadIndex: dfLoadIndex,
  saveIndex: dfSaveIndex,
  getBlock: dfGetBlock,
  blockToFeedItem: dfBlockToFeedItem,
  tagsOf: dfTagsOf,
  stripInlineTagText: dfStripInlineTagText,
  markdownLineToFragments: dfMarkdownLineToFragments,
  contentToMarkdown: dfContentToMarkdown,
  syncImagesToBlock: dfSyncImagesToBlock,
  resolveOrcaAssetSrc: dfResolveOrcaAssetSrc,
  hasTag: dfHasTag
};

globalThis.__DF_ORCA_BLOCKS = OrcaBlocks;
globalThis.dfResolveOrcaAssetSrc = dfResolveOrcaAssetSrc;
