// ============================================================
// src/orca-blocks.js — 日记流深融合虎鲸：块存储 / 查询 / 迁移
// 主存：日记页子块 + 固定标签「日记流」
// 插件侧：配置 / 置顶 / 点赞；评论主存为条目下带 df.comment 的子块
// ============================================================

var DF_TAG = "日记流";
var DF_INDEX_KEY = "moments-index";
var DF_BACKUP_KEY = "moments-records-backup";
var DF_MIGRATED_KEY = "moments-migrated";
var DF_TUTORIAL_DISMISSED_KEY = "tutorial-dismissed-v1";
var DF_TUTORIAL_ID_KEY = "tutorial-block-id";
/** 使用说明正文版本：改 DF_TUTORIAL_TEXT 时必须递增，已有说明块会按此同步 */
var DF_TUTORIAL_CONTENT_VER = "0.3.18";
var DF_TUTORIAL_CONTENT_VER_KEY = "tutorial-content-ver";
var DF_REF_TAG = 2; // BlockRef type: tag / property tag
var DF_LOC_PROP = "df.location";
var DF_ARCHIVED_PROP = "df.archived";
var DF_COMMENT_PROP = "df.comment";
var DF_COMMENT_ID_PROP = "df.commentId";
var DF_COMMENT_AUTHOR_PROP = "df.commentAuthor";
var DF_COMMENT_TIME_PROP = "df.commentTime";
var DF_PROP_TEXT = 1; // PropType.Text

var DF_TUTORIAL_TITLE = "日记流 · 使用说明";

/** 插件内嵌使用说明正文（勿写 #标签字样，避免 strip 误伤；勿用 - 前缀以免卡片当列表符显示） */
var DF_TUTORIAL_TEXT = [
  DF_TUTORIAL_TITLE,
  "本条由日记流插件自动置顶写入今日日记；手动删除后不再自动出现。",
  "—— 基本用法 ——",
  "右下角「+」：在今日日记新建一条，并跳转虎鲸编辑",
  "点卡片正文或「编辑」：在虎鲸中编辑该条目（时间线不扁改正文）",
  "封面区：设置封面、头像与签名",
  "底栏「地点」：写入正文末行「地点：…」，并同步属性",
  "评论：写入该条目下的虎鲸子块，可在日记页看到",
  "「⋯」展开：置顶、归档、改标签、管理图片、打开虎鲸、删除（进回收站）",
  "FAB：同步、工具、标签筛选、月份大纲；列表底部可「加载更多」",
  "—— 筛选与工具 ——",
  "标签筛选：点 FAB 选标签；筛选中再点 FAB，或再点同一标签，即可取消",
  "工具：归档柜、回收站、搜索、统计、导出、回顾、布局",
  "快捷筛选：有图 / 有地点 / 仅置顶；布局可选紧凑 / 舒适 / 高封面（窄屏建议紧凑）",
  "—— 重要规则 ——",
  "只有带「日记流」标签的日记块才会进入时间线",
  "月份大纲可按年份定位，再点月份跳到时间线对应分组",
  "归档后主时间线隐藏，块仍在日记页；可在归档柜取消归档",
  "日记流以展示为主；正文编辑以虎鲸日记页为准，改完会自动同步",
  "条目日期跟随所属日记页；换日期请用卡片改时间（会移动到对应日记）"
].join("\n");

var DF_TUTORIAL_TEXT_EN = [
  "Diary Flow · Getting Started",
  "This entry is pinned automatically by the Diary Flow plugin into today's journal; it won't reappear after you delete it manually.",
  "—— Basics ——",
  "Bottom-right “+”: create an entry in today's journal and jump to the Orca editor",
  "Click the card text or “Edit”: edit the entry in Orca (the timeline never edits text inline)",
  "Cover area: set cover, avatar and signature",
  "Bottom “Location”: writes “地点：…” as the last line and syncs a property",
  "Comments: written as Orca child blocks under the entry, visible on the journal page",
  "“⋯”: pin, archive, edit tags, manage images, open in Orca, delete (to trash)",
  "FAB: sync, tools, tag filter, month outline; “Load more” at the bottom of the list",
  "—— Filters & tools ——",
  "Tag filter: tap the FAB to pick a tag; tap the FAB again or the same tag to clear",
  "Tools: Archive, Trash, Search, Stats, Export, Recap, Layout",
  "Quick filters: has images / has location / pinned only; layout: compact / cozy / tall (compact suits narrow screens)",
  "—— Important rules ——",
  "Only journal blocks tagged “日记流” appear on the timeline",
  "The month outline jumps by year, then by month to the matching group",
  "Archiving hides an entry from the main timeline; the block stays on the journal page and can be unarchived in the Archive",
  "Diary Flow is for browsing; edit text on the Orca journal page and it syncs automatically",
  "An entry's date follows its journal page; use “Edit time” on the card to move it to another journal"
].join("\n");

function dfTutorialTitle() {
  return dfLocaleIsEn() ? "Diary Flow · Getting Started" : DF_TUTORIAL_TITLE;
}

function dfTutorialText() {
  return dfLocaleIsEn() ? DF_TUTORIAL_TEXT_EN : DF_TUTORIAL_TEXT;
}

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

/** 评论子块：属性 df.comment=1（或历史 #评论），不进正文、不成独立卡片 */
function dfIsCommentBlock(c) {
  if (!c) return false;
  if (dfHasTag(c, "评论")) return true;
  var v = dfProp(c, DF_COMMENT_PROP);
  return v === true || v === 1 || v === "1" || v === "true";
}

function dfIsSkippableEntryChild(c) {
  return dfIsMediaBlock(c) || dfIsCommentBlock(c) || dfHasTag(c, DF_TAG);
}

function dfGenCommentId() {
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function dfCommentDisplayText(name, text) {
  var n = String(name || "").trim() || "我";
  var t = String(text || "").trim();
  return n + "：" + t;
}

function dfParseCommentDisplayText(raw) {
  var s = String(raw || "").trim();
  var m = s.match(/^([^：:]{1,32})[：:]([\s\S]*)$/);
  if (m) return { name: m[1].trim(), text: m[2].trim() };
  return { name: "", text: s };
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
  if (dfIsCommentBlock(block)) return;
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

  // shallow：只收根 + 直接子行，不进孙块（feed 列表用）
  if (opts.maxDepth != null && !opts.isRoot && depth >= opts.maxDepth) return;

  var kids = await dfEnsureChildrenLoaded(block);
  // 无论父块是 text 还是 ul/ol，进入子级都加深一层（修复嵌套仍平铺）
  var childDepth = opts.isRoot ? 0 : depth + 1;
  var olIdx = 0;
  for (var i = 0; i < kids.length; i++) {
    var c = orca.state.blocks[kids[i]];
    if (!c || dfIsMediaBlock(c)) continue;
    if (dfIsCommentBlock(c)) continue;
    if (dfHasTag(c, DF_TAG)) continue;
    var ct = dfBlockRepr(c).type || "text";
    var childOpts = { isRoot: false, maxDepth: opts.maxDepth, rootTags: opts.rootTags };
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

/**
 * 收集条目正文：首块 + 子树（含嵌套列表，不含图片）
 * opts.shallow：只读根与直接子块，不 dfLoadBlockTree（feed 列表）
 */
async function dfCollectEntryText(block, opts) {
  if (!block) return "";
  opts = opts || {};
  var shallow = !!opts.shallow;
  if (!shallow) {
    var rooted = await dfLoadBlockTree(block.id);
    if (rooted) block = rooted;
  } else {
    try { await dfEnsureChildrenLoaded(block); } catch (eSh) { /* ignore */ }
  }
  await dfPrefetchRefTargets(block);
  var lines = [];
  var mdOpts = { isRoot: true, rootTags: dfTagsOf(block) };
  if (shallow) mdOpts.maxDepth = 0;
  await dfAppendEntryMarkdown(block, 0, lines, mdOpts);
  return lines
    .filter(function (x, idx) { return x || idx === 0; })
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
}

function dfEntryHasDeepChildren(block) {
  var kids = (block && block.children) || [];
  for (var i = 0; i < kids.length; i++) {
    var c = orca.state.blocks && orca.state.blocks[kids[i]];
    if (!c || dfIsSkippableEntryChild(c)) continue;
    if ((c.children || []).length) return true;
  }
  return false;
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

/**
 * feed 列表增量缓存：块及其直接子块、overlay 未变时复用上次构建结果，
 * 跳过昂贵的异步收集（图片/评论/日记日）。任何子块未载入则放弃缓存以保证正确性。
 */
var DF_FEED_ITEM_CACHE = Object.create(null);

function dfFeedListFp(block, overlay) {
  if (!block || !dfIsId(block.id) || !orca.state.blocks) return "";
  var parts = [
    "id:" + block.id,
    "p:" + String(block.parent || ""),
    "t:" + String(block.text || ""),
    "m:" + (block.modified instanceof Date ? block.modified.getTime() : Number(block.modified) || 0),
    "pr:" + JSON.stringify(block.properties || []),
    "rf:" + JSON.stringify(block.refs || []),
    "ov:" + JSON.stringify({
      p: overlay && overlay.pinned ? 1 : 0,
      a: overlay && overlay.archived ? 1 : 0,
      l: (overlay && overlay.location) || "",
      c: (overlay && overlay.createdAt) || "",
      i: (overlay && overlay.images) || [],
      k: (overlay && overlay.comments) || []
    })
  ];
  var kids = block.children || [];
  for (var i = 0; i < kids.length; i++) {
    var c = orca.state.blocks[kids[i]];
    if (!c) return "";
    parts.push("c" + kids[i] + ":" + String(c.text || "") + "|" +
      (c.modified instanceof Date ? c.modified.getTime() : Number(c.modified) || 0) + "|" +
      JSON.stringify(c.properties || []));
  }
  return parts.join("\u0001");
}

function dfPruneFeedCache(seen) {
  Object.keys(DF_FEED_ITEM_CACHE).forEach(function (k) {
    if (!seen[k]) delete DF_FEED_ITEM_CACHE[k];
  });
}

async function dfBlockToFeedItem(block, overlay, opts) {
  opts = opts || {};
  if (typeof block === "string" || typeof block === "number") {
    block = await dfGetBlock(block);
  }
  if (!block || !dfIsId(block.id)) return null;
  if (!overlay) {
    try {
      var idx0 = await dfLoadIndex();
      overlay = (idx0.overlays && idx0.overlays[String(block.id)]) || {};
    } catch (eOv) {
      overlay = {};
    }
  }
  overlay = overlay || {};
  var shallow = !!opts.shallow && !opts.fullText;

  var cacheFp = opts.useCache ? dfFeedListFp(block, overlay) : "";
  if (cacheFp) {
    var cachedHit = DF_FEED_ITEM_CACHE[String(block.id)];
    if (cachedHit && cachedHit.fp === cacheFp) {
      var ci = cachedHit.item;
      ci.archived = dfIsArchived(block, overlay);
      ci.pinned = !!(overlay.pinned || dfProp(block, "df.pinned"));
      ci.location = dfResolveLocation(block, overlay);
      return ci;
    }
  }

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
  var text = await dfCollectEntryText(block, { shallow: shallow });
  text = dfStripInlineTagText(text, tags);
  var fromBlock = (await dfCollectImageSrcs(block)).map(dfResolveOrcaAssetSrc).filter(dfIsDisplayableImgSrc);
  var fromOverlay = (Array.isArray(overlay.images) ? overlay.images : [])
    .filter(Boolean)
    .map(dfResolveOrcaAssetSrc)
    .filter(function (s) { return dfIsDisplayableImgSrc(s) || String(s).indexOf("dfasset:") === 0; })
    .slice(0, 99);
  var images = (fromBlock.length ? fromBlock : fromOverlay).slice(0, 9);
  var refs = dfOutgoingRefs(block);
  var needsFullText = shallow && dfEntryHasDeepChildren(block);
  var comments = await dfCollectCommentsFromBlock(block);
  var commentsFromBlocks = comments.length > 0;
  if (!commentsFromBlocks && Array.isArray(overlay.comments) && overlay.comments.length) {
    comments = overlay.comments.slice();
  }
  var item = {
    id: String(block.id),
    blockId: block.id,
    text: text,
    images: images,
    link: "",
    linkTitle: "",
    created: dfFmtCreated(created),
    createdAt: created.getTime(),
    comments: comments,
    commentsFromBlocks: commentsFromBlocks,
    needsCommentMigrate: !commentsFromBlocks && Array.isArray(overlay.comments) && overlay.comments.length > 0,
    pinned: !!(overlay.pinned || dfProp(block, "df.pinned")),
    archived: dfIsArchived(block, overlay),
    location: dfResolveLocation(block, overlay),
    tags: tags,
    refs: refs,
    needsFullText: !!needsFullText
  };
  if (cacheFp) {
    DF_FEED_ITEM_CACHE[String(block.id)] = { fp: cacheFp, item: item };
  }
  return item;
}

function dfIsArchivedFlag(v) {
  return v === true || v === 1 || v === "1" || v === "true";
}

function dfIsArchived(block, overlay) {
  if (overlay && dfIsArchivedFlag(overlay.archived)) return true;
  return dfIsArchivedFlag(dfProp(block, DF_ARCHIVED_PROP));
}

/** 归档 / 取消归档：双写属性 df.archived + overlay；归档时顺带取消置顶 */
async function setEntryArchived(blockId, archived) {
  var id = dfBlockId(blockId);
  if (!id) throw new Error("无效 blockId");
  var on = !!archived;
  var patch = { archived: on };
  if (on) patch.pinned = false;
  await setOverlay(id, patch);

  await dfWithEditor(async function () {
    if (on) {
      await dfEditorCommand("core.editor.setProperties", null, [id], [
        { name: DF_ARCHIVED_PROP, type: DF_PROP_TEXT, value: "1" }
      ]);
      try {
        await dfEditorCommand("core.editor.deleteProperties", null, [id], ["df.pinned"]);
      } catch (ePin) { /* ignore */ }
    } else {
      try {
        await dfEditorCommand("core.editor.deleteProperties", null, [id], [DF_ARCHIVED_PROP]);
      } catch (eDel) { /* ignore */ }
    }
  });
  try { delete orca.state.blocks[id]; } catch (e0) { /* ignore */ }
  return { blockId: id, archived: on };
}

async function listArchivedFeed(opts) {
  return listFeed(Object.assign({}, opts || {}, { archivedOnly: true, skipHeal: true }));
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
  try { await dfSaveIndexQueued(index); } catch (e) { /* ignore */ }
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

/** 索引写串行：避免 pin/评论/地点/ctx.save 并发 RMW 丢更新 */
var dfIndexChain = Promise.resolve();
function dfEnqueueIndex(task) {
  var run = dfIndexChain.then(function () {
    return task();
  });
  dfIndexChain = run.then(function () { /* keep chain */ }, function () { /* keep chain */ });
  return run;
}

async function dfSaveIndex(idx) {
  await orca.plugins.setData(orcaPluginName, DF_INDEX_KEY, JSON.stringify(idx || { overlays: {} }));
}

async function dfSaveIndexQueued(idx) {
  return dfEnqueueIndex(async function () {
    await dfSaveIndex(idx);
  });
}

/** mutator(index) 可同步或 async；在同一把锁内 load→mutate→save */
async function dfMutateIndex(mutator) {
  return dfEnqueueIndex(async function () {
    var index = await dfLoadIndex();
    var result = await mutator(index);
    await dfSaveIndex(index);
    return result;
  });
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
  var seenCache = {};
  // 默认不 heal：读 feed / 标签栏不得改日记结构；显式 skipHeal:false 或 healFeed() 才写库
  var skipHeal = opts.skipHeal !== false;
  var preferLive = opts.preferLive === true;
  var freezeState = !!opts.freezeState;
  var fullText = opts.fullText === true;
  var archivedOnly = opts.archivedOnly === true;
  var includeArchived = opts.includeArchived === true || archivedOnly;
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
          try { await dfSaveIndexQueued(index); } catch (eOv) { /* ignore */ }
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
    var item = await dfBlockToFeedItem(b, index.overlays[String(b.id)], {
      fullText: fullText,
      shallow: !fullText,
      useCache: skipHeal && !fullText,
      _feedList: true
    });
    if (item) {
      seenCache[String(item.id)] = true;
      var archived = !!item.archived;
      if (archivedOnly) {
        if (!archived) continue;
      } else if (!includeArchived && archived) {
        continue;
      }
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
      await dfSaveIndexQueued(index);
    } catch (eHealSave) { /* ignore */ }
  }
  // 仅完整 feed 才清理缓存，避免筛选/搜索调用误删未命中的缓存
  if (!kw && !tagFilter.length && !archivedOnly) dfPruneFeedCache(seenCache);
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
  var raw = opts.text != null ? String(opts.text) : "";
  var text = opts.skipTagStrip
    ? raw.replace(/\uFF03/g, "#").replace(/\r\n/g, "\n").trim()
    : dfStripInlineTagText(raw, extraTags);
  var lines = dfSplitEntryLines(text);
  if (!lines.length) lines = [""];
  var journal = await dfEnsureJournal(date);
  var newId = null;
  var keepFocus = !!(opts.focusBeforeTags || opts.keepEditorFocus);
  // 先插标题 + 标签；正文子块另开一轮写入，避免 insertTag 后同组插入被吃掉
  await dfWithEditor(async function () {
    var firstContent = lines[0] ? dfMarkdownLineToFragments(lines[0]) : null;
    newId = await dfEditorCommand(
      "core.editor.insertBlock",
      null,
      orca.state.blocks[journal.id] || journal,
      opts.firstChild ? "firstChild" : "lastChild",
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
  }, date, { keepFocus: keepFocus });

  if (dfIsId(newId)) {
    try {
      await dfWithEditor(async function () {
        var root = orca.state.blocks[newId] || { id: newId };
        // 清掉 insertTag 可能留下的空子块（单行条目同样需要清理，否则残留空行）
        var kids = (root.children || []);
        var emptyIds = [];
        for (var ki = 0; ki < kids.length; ki++) {
          var ch = orca.state.blocks[kids[ki]] || await dfGetBlock(kids[ki]);
          if (!ch || dfIsMediaBlock(ch) || dfIsCommentBlock(ch)) continue;
          var plain = dfPlainContentText(ch);
          if (!plain || !String(plain).trim()) emptyIds.push(ch.id);
        }
        if (emptyIds.length) {
          try { await dfEditorCommand("core.editor.deleteBlocks", null, emptyIds); } catch (e0) { /* ignore */ }
        }
        if (lines.length > 1) {
          root = orca.state.blocks[newId] || { id: newId };
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
        }
      }, date, { keepFocus: keepFocus });
    } catch (eBody) {
      console.warn("[orca-diaryflow] createEntry body lines failed, fallback updateEntry", eBody);
      try {
        await updateEntry(newId, { text: text, tags: extraTags });
      } catch (e2) {
        console.warn("[orca-diaryflow] createEntry updateEntry fallback failed", e2);
      }
    }
  }

  var orcaImgs = [];
  if (opts.images && opts.images.length) {
    try { orcaImgs = await dfSyncImagesToBlock(newId, opts.images); } catch (eImg) {
      console.warn("[orca-diaryflow] sync images on create failed", eImg);
    }
  }

  if (opts.location || orcaImgs.length || (opts.images && opts.images.length) || opts.pinned || opts.isTutorial) {
    await setOverlay(newId, {
      location: opts.location || "",
      images: orcaImgs.length ? orcaImgs : (Array.isArray(opts.images) ? opts.images.slice(0, 9) : []),
      imagesPushedToOrca: orcaImgs.length > 0,
      pinned: !!opts.pinned,
      comments: [],
      commentsStorage: "orca-blocks",
      isTutorial: !!opts.isTutorial
    });
  }
  if (Array.isArray(opts.comments) && opts.comments.length && dfIsId(newId)) {
    for (var ci = 0; ci < opts.comments.length; ci++) {
      try { await dfInsertCommentBlock(newId, opts.comments[ci]); } catch (eCmt) {
        console.warn("[orca-diaryflow] createEntry comment failed", eCmt);
      }
    }
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
  var raw = payload.text != null ? String(payload.text) : "";
  var text = payload.skipTagStrip
    ? raw.replace(/\uFF03/g, "#").replace(/\r\n/g, "\n").trim()
    : dfStripInlineTagText(raw, wantTags);
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
      // 保留媒体与评论子块，禁止 flatten 时误删
      if (ch && !dfIsMediaBlock(ch) && !dfIsCommentBlock(ch)) textChildIds.push(ch.id);
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
  if (payload.pinned !== undefined) patch.pinned = !!payload.pinned;
  // 评论主存虎鲸子块；updateEntry 不再把 comments 写进 overlay
  if (payload.isTutorial !== undefined) patch.isTutorial = !!payload.isTutorial;
  await setOverlay(id, patch);
  return dfGetBlock(id);
}

/**
 * 删除条目：默认先快照进回收站再删块（借鉴批注插件）；opts.skipTrash / opts.purge 则直接删。
 */
async function deleteEntry(blockId, opts) {
  var id = dfBlockId(blockId);
  if (!id) return false;
  opts = opts || {};
  var wasTutorial = false;
  try {
    var index0 = await dfLoadIndex();
    var ov0 = index0.overlays[String(id)] || {};
    if (ov0.isTutorial) wasTutorial = true;
    var stored = await orca.plugins.getData(orcaPluginName, DF_TUTORIAL_ID_KEY);
    if (String(stored || "") === String(id)) wasTutorial = true;
  } catch (eMark) { /* ignore */ }

  if (!opts.skipTrash && !opts.purge) {
    try {
      await dfMoveEntryToTrash(id);
    } catch (eTrash) {
      console.error("[orca-diaryflow] trash snapshot failed, cancel delete", eTrash);
      throw new Error("回收站快照失败，已取消删除以保数据：" + (eTrash && eTrash.message || eTrash));
    }
  }

  await dfWithEditor(async function () {
    await dfEditorCommand("core.editor.deleteBlocks", null, [id]);
  });
  var index = await dfLoadIndex();
  if (index.overlays[String(id)]) {
    delete index.overlays[String(id)];
    await dfSaveIndexQueued(index);
  }
  if (wasTutorial) {
    try {
      await orca.plugins.setData(orcaPluginName, DF_TUTORIAL_DISMISSED_KEY, "true");
      await orca.plugins.setData(orcaPluginName, DF_TUTORIAL_ID_KEY, null);
    } catch (e2) {
      console.warn("[orca-diaryflow] mark tutorial dismissed failed", e2);
    }
  }
  return true;
}

async function setOverlay(blockId, patch) {
  var id = String(dfBlockId(blockId) || blockId);
  return dfMutateIndex(function (index) {
    var next = Object.assign({}, index.overlays[id] || {}, patch || {});
    Object.keys(patch || {}).forEach(function (k) {
      if (patch[k] == null) delete next[k];
    });
    index.overlays[id] = next;
    return index.overlays[id];
  });
}

async function dfCollectCommentsFromBlock(block) {
  if (!block || !dfIsId(block.id)) return [];
  try { await dfEnsureChildrenLoaded(block); } catch (e0) { /* ignore */ }
  var kids = (block.children || []);
  var out = [];
  for (var i = 0; i < kids.length; i++) {
    var c = orca.state.blocks[kids[i]] || await dfGetBlock(kids[i]);
    if (!c || !dfIsCommentBlock(c)) continue;
    var raw = "";
    try { raw = dfPlainContentText(c) || ""; } catch (e1) { raw = ""; }
    if (!raw) {
      try { raw = dfContentToMarkdown(c.content || [], c) || ""; } catch (e2) { raw = ""; }
    }
    var parsed = dfParseCommentDisplayText(raw);
    var author = dfProp(c, DF_COMMENT_AUTHOR_PROP);
    var time = dfProp(c, DF_COMMENT_TIME_PROP);
    var cid = dfProp(c, DF_COMMENT_ID_PROP);
    out.push({
      id: cid != null && String(cid) ? String(cid) : String(c.id),
      blockId: c.id,
      name: author != null && String(author) ? String(author) : (parsed.name || "我"),
      text: parsed.text || String(raw || "").trim(),
      time: time != null && String(time) ? String(time) : dfFmtCreated(c.created instanceof Date ? c.created : new Date(c.created || Date.now()))
    });
  }
  return out;
}

async function dfInsertCommentBlock(entryId, comment) {
  var id = dfBlockId(entryId);
  if (!id) throw new Error("无效 blockId");
  comment = comment || {};
  var cid = String(comment.id || dfGenCommentId());
  var name = String(comment.name || "我").trim() || "我";
  var text = String(comment.text || "").trim();
  if (!text) throw new Error("评论不能为空");
  var time = String(comment.time || dfFmtCreated(new Date()));
  var display = dfCommentDisplayText(name, text);
  var newId = null;
  await dfWithEditor(async function () {
    var root = orca.state.blocks[id] || { id: id };
    newId = await dfEditorCommand(
      "core.editor.insertBlock",
      null,
      root,
      "lastChild",
      dfMarkdownLineToFragments(display),
      { type: "text" }
    );
    if (!dfIsId(newId)) throw new Error("插入评论块失败");
    await dfEditorCommand("core.editor.setProperties", null, [newId], [
      { name: DF_COMMENT_PROP, type: DF_PROP_TEXT, value: "1" },
      { name: DF_COMMENT_ID_PROP, type: DF_PROP_TEXT, value: cid },
      { name: DF_COMMENT_AUTHOR_PROP, type: DF_PROP_TEXT, value: name },
      { name: DF_COMMENT_TIME_PROP, type: DF_PROP_TEXT, value: time }
    ]);
  });
  try { delete orca.state.blocks[id]; } catch (e0) { /* ignore */ }
  return {
    id: cid,
    blockId: newId,
    name: name,
    text: text,
    time: time
  };
}

/** 新增评论：写入条目下的虎鲸子块，并清空 overlay.comments（避免双源） */
async function addComment(entryId, comment) {
  var saved = await dfInsertCommentBlock(entryId, comment);
  await setOverlay(entryId, {
    comments: [],
    commentsStorage: "orca-blocks"
  });
  return saved;
}

async function deleteComment(entryId, commentId) {
  var id = dfBlockId(entryId);
  if (!id) throw new Error("无效 blockId");
  var want = String(commentId || "");
  if (!want) return false;
  var block = await dfGetBlock(id);
  var list = await dfCollectCommentsFromBlock(block || { id: id });
  var hit = null;
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].id) === want || String(list[i].blockId) === want) {
      hit = list[i];
      break;
    }
  }
  if (!hit || !dfIsId(hit.blockId)) {
    // 兼容尚未迁移的 overlay 评论：只改 overlay
    await dfMutateIndex(function (index) {
      var key = String(id);
      var ov = index.overlays[key] || {};
      var next = (Array.isArray(ov.comments) ? ov.comments : []).filter(function (c) {
        return String(c && c.id) !== want;
      });
      index.overlays[key] = Object.assign({}, ov, { comments: next });
    });
    return true;
  }
  await dfWithEditor(async function () {
    await dfEditorCommand("core.editor.deleteBlocks", null, [hit.blockId]);
  });
  try { delete orca.state.blocks[id]; } catch (e0) { /* ignore */ }
  try { delete orca.state.blocks[hit.blockId]; } catch (e1) { /* ignore */ }
  return true;
}

/** 编辑评论：重写虎鲸子块正文（覆盖旧 overlay 评论） */
async function updateComment(entryId, commentId, newText) {
  var id = dfBlockId(entryId);
  if (!id) throw new Error("无效 blockId");
  var want = String(commentId || "");
  if (!want) throw new Error("无效评论 ID");
  var text = String(newText == null ? "" : newText).trim();
  if (!text) throw new Error("评论不能为空");
  var block = await dfGetBlock(id);
  var list = await dfCollectCommentsFromBlock(block || { id: id });
  var hit = null;
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].id) === want || String(list[i].blockId) === want) {
      hit = list[i];
      break;
    }
  }
  if (!hit || !dfIsId(hit.blockId)) {
    // 兼容尚未迁移的 overlay 评论：只改 overlay
    await dfMutateIndex(function (index) {
      var key = String(id);
      var ov = index.overlays[key] || {};
      var arr = (Array.isArray(ov.comments) ? ov.comments : []).map(function (c) {
        if (String(c && c.id) === want) return Object.assign({}, c, { text: text });
        return c;
      });
      index.overlays[key] = Object.assign({}, ov, { comments: arr });
    });
    return { id: want, text: text, migrated: false };
  }
  var display = dfCommentDisplayText(hit.name, text);
  await dfWithEditor(async function () {
    await dfEditorCommand("core.editor.setBlocksContent", null, [{
      id: hit.blockId,
      content: dfMarkdownLineToFragments(display)
    }], false);
  });
  try { delete orca.state.blocks[id]; } catch (e0) { /* ignore */ }
  try { delete orca.state.blocks[hit.blockId]; } catch (e1) { /* ignore */ }
  return { id: hit.id, blockId: hit.blockId, name: hit.name, text: text, time: hit.time };
}

/** 把 overlay 里的旧评论一次性迁到虎鲸子块 */
async function migrateEntryComments(entryId) {
  var id = dfBlockId(entryId);
  if (!id) return { migrated: 0 };
  var index = await dfLoadIndex();
  var ov = (index.overlays && index.overlays[String(id)]) || {};
  var pending = Array.isArray(ov.comments) ? ov.comments.filter(Boolean) : [];
  var existing = await dfCollectCommentsFromBlock((await dfGetBlock(id)) || { id: id });
  if (existing.length) {
    if (pending.length) {
      await setOverlay(id, { comments: [], commentsStorage: "orca-blocks" });
    }
    return { migrated: 0, already: existing.length };
  }
  if (!pending.length) return { migrated: 0 };
  var n = 0;
  for (var i = 0; i < pending.length; i++) {
    try {
      await dfInsertCommentBlock(id, pending[i]);
      n++;
    } catch (e) {
      console.warn("[orca-diaryflow] migrate comment failed", pending[i] && pending[i].id, e);
    }
  }
  await setOverlay(id, { comments: [], commentsStorage: "orca-blocks" });
  return { migrated: n };
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

function dfIsLocationLineText(s) {
  s = String(s || "").trim();
  return /^地点\s*[:：]/.test(s) || /^📍/.test(s);
}

/** 收集条目树中表示「地点：…」的文字块（不含媒体 / 独立日记流子条目） */
async function dfCollectLocationLineBlocks(root) {
  var found = [];
  if (!root || !dfIsId(root.id)) return found;
  async function walk(b, isRoot) {
    if (!b) return;
    if (dfIsMediaBlock(b)) return;
    if (dfIsCommentBlock(b)) return;
    if (!isRoot && dfHasTag(b, DF_TAG)) return;
    var plain = "";
    try { plain = dfPlainContentText(b) || ""; } catch (e0) { plain = ""; }
    var md = "";
    try { md = dfContentToMarkdown(b.content || [], b) || ""; } catch (e1) { md = ""; }
    var line = String(plain || md || "").replace(/\r\n/g, "\n").trim();
    // 单行地点块；或整段唯一一行是地点
    if (line && dfIsLocationLineText(line.split("\n")[0]) && line.split("\n").filter(Boolean).length <= 1) {
      found.push(b);
    }
    var kids = b.children || [];
    if (kids.length) {
      var need = kids.filter(function (cid) { return !(orca.state.blocks && orca.state.blocks[cid]); });
      if (need.length) {
        try {
          var got = await orca.invokeBackend("get-blocks", need);
          if (Array.isArray(got)) got.forEach(function (x) { if (x && x.id) orca.state.blocks[x.id] = x; });
        } catch (e2) { /* ignore */ }
      }
      for (var i = 0; i < kids.length; i++) {
        var c = orca.state.blocks[kids[i]] || await dfGetBlock(kids[i]);
        await walk(c, false);
      }
    }
  }
  await walk(root, true);
  return found;
}

/**
 * 地点：双写 overlay + 块属性 df.location，并定向更新/插入「地点：」子块。
 * 禁止删光子树再 flatten（会丢嵌套大纲）。
 */
async function updateEntryLocation(blockId, location) {
  var id = dfBlockId(blockId);
  if (!id) throw new Error("无效 blockId");
  var loc = String(location == null ? "" : location).trim();

  await setOverlay(id, { location: loc });

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

    var block = await dfGetBlock(id);
    var locBlocks = await dfCollectLocationLineBlocks(block || { id: id });
    var lineText = loc ? ("地点：" + loc) : "";

    if (!loc) {
      var toDel = [];
      for (var di = 0; di < locBlocks.length; di++) {
        var db = locBlocks[di];
        if (!db || !dfIsId(db.id)) continue;
        if (db.id === id) {
          // 根块整段就是地点行：清空内容，保留块与子树
          await dfEditorCommand("core.editor.setBlocksContent", null, [{
            id: id,
            content: [{ t: "t", v: "" }]
          }], false);
        } else {
          toDel.push(db.id);
        }
      }
      if (toDel.length) {
        try { await dfEditorCommand("core.editor.deleteBlocks", null, toDel); } catch (eDel2) { /* ignore */ }
      }
    } else if (locBlocks.length) {
      var primary = locBlocks[0];
      await dfEditorCommand("core.editor.setBlocksContent", null, [{
        id: primary.id,
        content: dfMarkdownLineToFragments(lineText)
      }], false);
      var extras = [];
      for (var ei = 1; ei < locBlocks.length; ei++) {
        if (locBlocks[ei] && locBlocks[ei].id && locBlocks[ei].id !== id) extras.push(locBlocks[ei].id);
      }
      if (extras.length) {
        try { await dfEditorCommand("core.editor.deleteBlocks", null, extras); } catch (eEx) { /* ignore */ }
      }
    } else {
      var root = orca.state.blocks[id] || { id: id };
      await dfEditorCommand(
        "core.editor.insertBlock",
        null,
        root,
        "lastChild",
        dfMarkdownLineToFragments(lineText),
        { type: "text" }
      );
    }
  });

  try { delete orca.state.blocks[id]; } catch (e0) { /* ignore */ }
  var blockOut = await dfGetBlock(id);
  return { block: blockOut, location: loc };
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
  // 只扫带 #日记流 的块标签，不跑 listFeed / heal / 收正文
  var blocks = [];
  try {
    blocks = (await orca.invokeBackend("get-blocks-with-tags", [DF_TAG])) || [];
  } catch (e) {
    console.warn("[orca-diaryflow] collectUserTags get-blocks-with-tags failed", e);
    blocks = [];
  }
  if (!Array.isArray(blocks)) blocks = [];
  var set = new Set();
  for (var i = 0; i < blocks.length; i++) {
    dfNormalizeUserTags(dfTagsOf(blocks[i])).forEach(function (t) { set.add(t); });
  }
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

function dfLooksLikeTutorialBlock(block) {
  if (!block) return false;
  if (dfHasTag(block, "教程")) return true;
  var plain = dfPlainContentText(block) || "";
  var md = "";
  try { md = dfContentToMarkdown(block.content || [], block) || ""; } catch (e) { /* ignore */ }
  var head = String(plain || md || "").trim();
  return head.indexOf(DF_TUTORIAL_TITLE) === 0 || head === DF_TUTORIAL_TITLE ||
    head.indexOf("Diary Flow · Getting Started") === 0;
}

async function dfTutorialBodyIsThin(block) {
  if (!block) return true;
  var rooted = null;
  try { rooted = await dfLoadBlockTree(block.id); } catch (e) { rooted = block; }
  var text = "";
  try { text = await dfCollectEntryText(rooted || block); } catch (e2) {
    text = dfPlainContentText(block) || "";
  }
  var lines = dfSplitEntryLines(text);
  if (lines.length < 3) return true;
  var body = lines.slice(1).join("\n").trim();
  return body.length < 20;
}

/**
 * 打开插件时确保使用说明存在：置顶、写入今日日记顶部。
 * 手动删除后写入 dismissed，不再自动插入；未删除则每次打开都会补齐/补正文。
 */
async function ensureTutorialInserted() {
  var dismissed = await orca.plugins.getData(orcaPluginName, DF_TUTORIAL_DISMISSED_KEY);
  if (dismissed === true || dismissed === "true" || dismissed === 1) {
    return { skipped: true, reason: "dismissed" };
  }

  var today = new Date();
  var index = await dfLoadIndex();
  var foundId = null;

  var storedId = dfBlockId(await orca.plugins.getData(orcaPluginName, DF_TUTORIAL_ID_KEY));
  if (storedId) {
    var storedBlock = await dfGetBlock(storedId);
    if (storedBlock) foundId = storedId;
  }
  if (!foundId && index && index.overlays) {
    var keys = Object.keys(index.overlays);
    for (var i = 0; i < keys.length; i++) {
      if (index.overlays[keys[i]] && index.overlays[keys[i]].isTutorial) {
        var bid = dfBlockId(keys[i]);
        if (bid && (await dfGetBlock(bid))) {
          foundId = bid;
          break;
        }
      }
    }
  }
  if (!foundId) {
    // 扫今日日记：找回仅有标题、无正文的旧教程块
    try {
      var journal = await dfEnsureJournal(today);
      var kids = (journal && journal.children) || [];
      for (var j = 0; j < kids.length; j++) {
        var ch = orca.state.blocks[kids[j]] || await dfGetBlock(kids[j]);
        if (ch && dfHasTag(ch, DF_TAG) && dfLooksLikeTutorialBlock(ch)) {
          foundId = ch.id;
          break;
        }
      }
    } catch (eScan) {
      console.warn("[orca-diaryflow] scan tutorial in journal failed", eScan);
    }
  }

  if (foundId) {
    var block = await dfGetBlock(foundId);
    var thin = await dfTutorialBodyIsThin(block);
    var storedVer = await orca.plugins.getData(orcaPluginName, DF_TUTORIAL_CONTENT_VER_KEY);
    var verStale = String(storedVer || "") !== DF_TUTORIAL_CONTENT_VER;
    // 正文残缺，或插件升级导致说明文案版本落后 → 同步内嵌教程
    // （说明块由插件维护；用户手动删除后走 dismissed，不再自动出现）
    if (thin || verStale) {
      await updateEntry(foundId, {
        text: dfTutorialText(),
        tags: ["教程"],
        pinned: true,
        isTutorial: true,
        skipTagStrip: true
      });
      await orca.plugins.setData(orcaPluginName, DF_TUTORIAL_CONTENT_VER_KEY, DF_TUTORIAL_CONTENT_VER);
    } else {
      await setOverlay(foundId, { pinned: true, isTutorial: true });
    }
    // 挪到今日日记顶部
    try {
      var j2 = await dfEnsureJournal(today);
      var b2 = await dfGetBlock(foundId);
      if (b2 && dfIsId(j2.id) && (b2.parent !== j2.id || (j2.children && j2.children[0] !== foundId))) {
        await dfWithEditor(async function () {
          await dfEditorCommand("core.editor.moveBlocks", null, [foundId], j2.id, "firstChild");
        }, today);
      }
    } catch (eMove) {
      console.warn("[orca-diaryflow] move tutorial to journal top failed", eMove);
    }
    await orca.plugins.setData(orcaPluginName, DF_TUTORIAL_ID_KEY, String(foundId));
    return {
      skipped: false,
      repaired: !!thin,
      refreshed: !!(thin || verStale),
      contentVer: DF_TUTORIAL_CONTENT_VER,
      blockId: foundId
    };
  }

  var created = await createEntry({
    date: today,
    text: dfTutorialText(),
    tags: ["教程"],
    pinned: true,
    isTutorial: true,
    firstChild: true,
    skipTagStrip: true
  });
  var newId = dfBlockId(created);
  if (newId) {
    await setOverlay(newId, { pinned: true, isTutorial: true });
    await orca.plugins.setData(orcaPluginName, DF_TUTORIAL_ID_KEY, String(newId));
    await orca.plugins.setData(orcaPluginName, DF_TUTORIAL_CONTENT_VER_KEY, DF_TUTORIAL_CONTENT_VER);
  }
  return { skipped: false, created: true, contentVer: DF_TUTORIAL_CONTENT_VER, blockId: newId };
}

/** 一次性清理旧 overlay 中遗留的 liked 字段（点赞功能已移除） */
async function dfCleanupLegacyOverlays() {
  var index = await dfLoadIndex();
  var ov = index.overlays || {};
  var changed = false;
  Object.keys(ov).forEach(function (k) {
    if (ov[k] && Object.prototype.hasOwnProperty.call(ov[k], "liked")) {
      delete ov[k].liked;
      changed = true;
    }
  });
  if (changed) {
    try { await dfSaveIndexQueued(index); } catch (e) { /* ignore */ }
  }
  return changed;
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
    await dfMutateIndex(function (emptyIdx) {
      if (legacy && legacy.config) emptyIdx.config = legacy.config;
      emptyIdx.migratedFromMoments = true;
    });
    return { skipped: true, count: 0 };
  }

  try {
    await orca.plugins.setData(orcaPluginName, DF_BACKUP_KEY, JSON.stringify(legacy));
  } catch (e) {
    console.warn("[orca-diaryflow] backup moments-records failed", e);
  }

  // 已按 legacyId 写入的条目：失败重试时跳过，避免重复块
  var doneLegacy = {};
  try {
    var idx0 = await dfLoadIndex();
    Object.keys(idx0.overlays || {}).forEach(function (k) {
      var ov = idx0.overlays[k];
      if (ov && ov.legacyId != null) doneLegacy[String(ov.legacyId)] = true;
    });
  } catch (eDone) { /* ignore */ }

  var count = 0;
  var commentsNote =
    "评论主存为条目下 df.comment 子块；旧 overlay 评论会在打开时间线时迁移。";
  for (var i = 0; i < legacy.items.length; i++) {
    var it = legacy.items[i];
    if (!it) continue;
    var legacyKey = it.id != null ? String(it.id) : "";
    if (legacyKey && doneLegacy[legacyKey]) continue;
    try {
      var date = it.createdAt ? new Date(it.createdAt) : new Date(String(it.created || "").replace(" ", "T"));
      if (isNaN(date.getTime())) date = new Date();
      var text = it.text || "";
      if (it.location) text = text + (text ? "\n" : "") + "地点：" + it.location;
      // 图片进 overlay / 块，不再把 URL 当正文行内联
      var imgs = Array.isArray(it.images) ? it.images.filter(Boolean).slice(0, 9) : [];
      var block = await createEntry({
        date: date,
        text: text,
        tags: it.tags || [],
        images: imgs,
        location: it.location || ""
      });
      var bid = dfBlockId(block);
      if (bid) {
        var cmts = Array.isArray(it.comments) ? it.comments : [];
        for (var ci = 0; ci < cmts.length; ci++) {
          try { await dfInsertCommentBlock(bid, cmts[ci]); } catch (eC) {
            console.warn("[orca-diaryflow] migrate comment on create failed", eC);
          }
        }
        await setOverlay(bid, {
          pinned: !!it.pinned,
          comments: [],
          location: it.location || "",
          images: imgs,
          imagesPushedToOrca: false,
          legacyId: it.id,
          commentsStorage: "orca-blocks"
        });
        if (legacyKey) doneLegacy[legacyKey] = true;
        count++;
      }
    } catch (e2) {
      console.warn("[orca-diaryflow] migrate item failed", it && it.id, e2);
    }
  }
  await dfMutateIndex(function (index) {
    if (legacy.config) index.config = legacy.config;
    index.migratedFromMoments = true;
    index.commentsStorageNote = commentsNote;
  });
  await orca.plugins.setData(orcaPluginName, DF_MIGRATED_KEY, "true");
  return { skipped: false, count: count };
}

var OrcaBlocks = {
  TAG: DF_TAG,
  INDEX_KEY: DF_INDEX_KEY,
  TUTORIAL_DISMISSED_KEY: DF_TUTORIAL_DISMISSED_KEY,
  TUTORIAL_ID_KEY: DF_TUTORIAL_ID_KEY,
  listFeed: listFeed,
  createEntry: createEntry,
  updateEntry: updateEntry,
  updateEntryTime: updateEntryTime,
  updateEntryLocation: updateEntryLocation,
  updateEntryTags: updateEntryTags,
  deleteEntry: deleteEntry,
  setEntryArchived: setEntryArchived,
  listArchivedFeed: listArchivedFeed,
  setOverlay: setOverlay,
  addComment: addComment,
  deleteComment: deleteComment,
  updateComment: updateComment,
  migrateEntryComments: migrateEntryComments,
  mutateIndex: dfMutateIndex,
  collectUserTags: collectUserTags,
  openEntry: openEntry,
  ensureTutorialInserted: ensureTutorialInserted,
  migrateMomentsRecords: migrateMomentsRecords,
  cleanupLegacyOverlays: dfCleanupLegacyOverlays,
  blockToFeedItem: dfBlockToFeedItem,
  stripInlineTagText: dfStripInlineTagText,
  markdownLineToFragments: dfMarkdownLineToFragments,
  contentToMarkdown: dfContentToMarkdown,
  srcToOrcaAsset: dfSrcToOrcaAsset,
  resolveOrcaAssetSrc: dfResolveOrcaAssetSrc
};

globalThis.__DF_ORCA_BLOCKS = OrcaBlocks;
globalThis.dfResolveOrcaAssetSrc = dfResolveOrcaAssetSrc;
