// ============================================================
// src/orca-blocks.js — 日记流深融合虎鲸：块存储 / 查询 / 迁移
// 主存：日记页子块 + 固定标签「日记流」；插件侧只留配置与评论索引
// ============================================================

var DF_TAG = "日记流";
var DF_INDEX_KEY = "moments-index";
var DF_BACKUP_KEY = "moments-records-backup";
var DF_MIGRATED_KEY = "moments-migrated";
var DF_REF_TAG = 2; // BlockRef type: tag / property tag

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
  for (var i = 0; i < refs.length; i++) {
    var r = refs[i];
    if (!r || r.type === DF_REF_TAG) continue;
    out.push({ id: r.to, alias: r.alias || "", type: r.type });
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

async function dfHealPlainTagText(block) {
  if (!block || !dfIsId(block.id)) return block;
  var tags = dfTagsOf(block);
  var plain = dfPlainContentText(block);
  var raw = plain != null ? plain : String(block.text || "");
  if (!raw) return block;
  var clean = dfStripInlineTagText(raw, tags);
  if (clean === String(raw).trim()) return block;
  // .text 可能只是「正文+标签」展平；仅当纯文本节点里已含 #标签，或能确认 content 脏时才改块
  if (plain == null) {
    var hasHashTag = raw.indexOf("#" + DF_TAG) >= 0 ||
      tags.some(function (t) { return raw.indexOf("#" + t) >= 0; });
    if (!hasHashTag) return block;
  }
  try {
    await dfWithEditor(async function () {
      await dfEditorCommand("core.editor.setBlocksContent", null, [{
        id: block.id,
        content: clean ? [{ t: "t", v: clean }] : [{ t: "t", v: "" }]
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
  async function pushFrom(c) {
    if (!c || imgs.length >= 9) return false;
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
    for (var i = 0; i < kids.length && imgs.length < 9; i++) {
      await pushFrom(orca.state.blocks[kids[i]]);
    }
  }

  // 虎鲸原生插入图片是「同级 after」，也扫紧随其后的媒体兄弟块
  if (block && dfIsId(block.parent) && imgs.length < 9) {
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
      for (var k = idx + 1; k < sibs.length && imgs.length < 9; k++) {
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
      var abs = src.replace(/\\/g, "/");
      return "file:///" + abs.replace(/^\/+/, "");
    }
    if (src.startsWith("/") && !src.startsWith("//")) {
      return "file://" + src;
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
    var fsPath = repoDir + sep + "assets" + sep + rel.split("/").join(sep);
    try {
      if (orca.utils && typeof orca.utils.getAssetPath === "function") {
        fsPath = orca.utils.getAssetPath(fsPath) || fsPath;
      }
    } catch (e2) { /* ignore */ }
    if (/^(file|https?):/i.test(fsPath)) return fsPath;
    var norm = String(fsPath).replace(/\\/g, "/");
    if (/^[A-Za-z]:\//.test(norm)) return "file:///" + norm;
    return "file://" + (norm.startsWith("/") ? "" : "/") + norm;
  } catch (e) {
    return src;
  }
}

function dfIsDisplayableImgSrc(s) {
  return !!s && /^(https?:|data:|blob:|dfasset:|file:)/i.test(String(s));
}

/** 把 dfasset/blob/dataURL 上传为虎鲸仓库资源，返回可用 src */
async function dfSrcToOrcaAsset(src) {
  if (!src) return null;
  src = String(src);
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("./")) return src;
  if (src.indexOf("://") < 0 && !src.startsWith("data:") && !src.startsWith("blob:") && !src.startsWith("dfasset:")) {
    return src.startsWith("/") ? "." + src : "./" + src.replace(/^\.\//, "");
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
    } else if (src.startsWith("blob:")) {
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
  var repr = c._repr || c.repr || {};
  if (!repr.type) {
    var raw = dfProp(c, "_repr");
    if (raw && typeof raw === "object") repr = raw;
    else if (typeof raw === "string") {
      try { repr = JSON.parse(raw); } catch (e) { repr = {}; }
    }
  }
  return repr.type === "image" || repr.type === "video";
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

/** 收集条目正文：首块 + 子级文字块（不含图片） */
async function dfCollectEntryText(block) {
  if (!block) return "";
  var tags = dfTagsOf(block);
  var lines = [dfStripInlineTagText((block.text || "").trim(), tags)];
  var kids = block.children || [];
  if (!kids.length) return lines.filter(Boolean).join("\n");
  var need = kids.filter(function (id) { return !orca.state.blocks[id]; });
  if (need.length) {
    try {
      var got = await orca.invokeBackend("get-blocks", need);
      if (Array.isArray(got)) got.forEach(function (b) { if (b && b.id) orca.state.blocks[b.id] = b; });
    } catch (e) { /* ignore */ }
  }
  for (var i = 0; i < kids.length; i++) {
    var c = orca.state.blocks[kids[i]];
    if (!c || dfIsMediaBlock(c)) continue;
    var t = dfStripInlineTagText((c.text || "").trim(), dfTagsOf(c));
    if (t) lines.push(t);
  }
  return lines.filter(function (x, idx) { return x || idx === 0; }).join("\n").replace(/^\n+|\n+$/g, "");
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

async function dfBlockToFeedItem(block, overlay) {
  if (!block || !dfIsId(block.id)) return null;
  overlay = overlay || {};
  var created = block.created instanceof Date ? block.created : new Date(block.created || Date.now());
  var tags = dfTagsOf(block);
  var text = await dfCollectEntryText(block);
  text = dfStripInlineTagText(text, tags);
  var fromBlock = (await dfCollectImageSrcs(block)).map(dfResolveOrcaAssetSrc).filter(dfIsDisplayableImgSrc);
  var fromOverlay = (Array.isArray(overlay.images) ? overlay.images : [])
    .filter(Boolean)
    .map(dfResolveOrcaAssetSrc)
    .filter(function (s) { return dfIsDisplayableImgSrc(s) || String(s).indexOf("dfasset:") === 0; })
    .slice(0, 9);
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
    location: overlay.location || dfProp(block, "df.location") || "",
    tags: tags,
    refs: refs
  };
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
    blocks = blocks.filter(function (b) {
      if (hitIds && hitIds.size) return hitIds.has(b.id);
      var blob = ((b.text || "") + " " + dfTagsOf(b).join(" ")).toLowerCase();
      return blob.indexOf(kwLower) >= 0;
    });
  }

  var index = await dfLoadIndex();
  var items = [];
  for (var i = 0; i < blocks.length; i++) {
    var b = blocks[i];
    if (b && b.id) orca.state.blocks[b.id] = b;
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
    // 跳过已是其它日记流条目子块的残留
    if (b && dfIsId(b.parent)) {
      var p = orca.state.blocks[b.parent] || await dfGetBlock(b.parent);
      if (p && dfHasTag(p, DF_TAG) && p.id !== b.id) continue;
    }
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
    if (b && b.id) orca.state.blocks[b.id] = b;
    var item = await dfBlockToFeedItem(b, index.overlays[String(b.id)]);
    if (item) items.push(item);
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
async function dfWithEditor(fn, dateHint) {
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
    if (prev) {
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
  await dfWithEditor(async function () {
    // 首行：打 #日记流 + 用户标签
    newId = await dfEditorCommand(
      "core.editor.insertBlock",
      null,
      orca.state.blocks[journal.id] || journal,
      "lastChild",
      lines[0] ? [{ t: "t", v: lines[0] }] : [{ t: "t", v: "" }],
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
        [{ t: "t", v: lines[li] }],
        { type: "text" }
      );
    }
  }, date);

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
      content: lines[0] ? [{ t: "t", v: lines[0] }] : [{ t: "t", v: "" }]
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
        [{ t: "t", v: lines[li] }],
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
  index.overlays[id] = Object.assign({}, index.overlays[id] || {}, patch || {});
  await dfSaveIndex(index);
  return index.overlays[id];
}

async function collectUserTags() {
  var feed = await listFeed({});
  var set = new Set();
  feed.items.forEach(function (it) {
    (it.tags || []).forEach(function (t) { if (t) set.add(t); });
  });
  return Array.from(set).sort();
}

async function openEntry(blockId, panelId) {
  var id = dfBlockId(blockId);
  if (!id) return false;
  try {
    if (panelId) {
      orca.nav.goTo("block", { blockId: id }, panelId);
    } else {
      orca.nav.openInLastPanel("block", { blockId: id });
    }
    return true;
  } catch (e) {
    console.warn("[orca-diaryflow] openEntry failed", e);
    try {
      orca.nav.openInLastPanel("block", { blockId: id });
      return true;
    } catch (e2) {
      return false;
    }
  }
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
  syncImagesToBlock: dfSyncImagesToBlock,
  resolveOrcaAssetSrc: dfResolveOrcaAssetSrc,
  hasTag: dfHasTag
};

globalThis.__DF_ORCA_BLOCKS = OrcaBlocks;

module.exports = globalThis.__DF_ORCA_BLOCKS;
