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
 * 去掉正文里与虎鲸标签重复的「#标签」字样（含 #a,#b 连写）。
 * 只影响展示/回写纯文本，不删真实 tag refs。
 */
function dfStripInlineTagText(text, tagNames) {
  var s = String(text == null ? "" : text);
  if (!s) return "";
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
  // 按长到短替换，避免短名误伤
  names.sort(function (a, b) { return b.length - a.length; });
  for (var i = 0; i < names.length; i++) {
    var re = new RegExp("#" + dfEscapeRe(names[i]) + "(?=$|[\\s,，、#])", "g");
    s = s.replace(re, "");
  }
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
  var kids = (block && block.children) || [];
  if (!kids.length) return imgs;
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
    var c = orca.state.blocks[kids[i]];
    if (!c) continue;
    var repr = c._repr || c.repr || {};
    var type = repr.type || "";
    if (type === "image" || type === "video") {
      var src = repr.src || repr.path || dfProp(c, "src") || "";
      if (src) {
        try {
          if (typeof orca.utils.getAssetPath === "function" && String(src).indexOf("://") < 0) {
            src = orca.utils.getAssetPath(String(src).replace(/^\.\//, ""));
          }
        } catch (e2) { /* keep raw */ }
        imgs.push(src);
      }
    }
  }
  return imgs;
}

async function dfBlockToFeedItem(block, overlay) {
  if (!block || !dfIsId(block.id)) return null;
  overlay = overlay || {};
  var created = block.created instanceof Date ? block.created : new Date(block.created || Date.now());
  var tags = dfTagsOf(block);
  var text = dfStripInlineTagText((block.text || "").trim(), tags);
  var images = Array.isArray(overlay.images) && overlay.images.length
    ? overlay.images.filter(Boolean).slice(0, 9)
    : await dfCollectImageSrcs(block);
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
  var journal = await dfEnsureJournal(date);
  var newId = null;
  await dfWithEditor(async function () {
    newId = await dfEditorCommand(
      "core.editor.insertBlock",
      null,
      orca.state.blocks[journal.id] || journal,
      "lastChild",
      text ? [{ t: "t", v: text }] : [{ t: "t", v: "" }],
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
  }, date);
  if (opts.location || (opts.images && opts.images.length) || opts.liked || opts.pinned || opts.comments) {
    await setOverlay(newId, {
      location: opts.location || "",
      images: Array.isArray(opts.images) ? opts.images.slice(0, 9) : [],
      liked: !!opts.liked,
      pinned: !!opts.pinned,
      comments: Array.isArray(opts.comments) ? opts.comments : []
    });
  }
  var block = await dfGetBlock(newId);
  return block || { id: newId };
}

/** 轻量编辑：更新正文 + 补齐标签；图片/地点写入 overlay */
async function updateEntry(blockId, payload) {
  var id = dfBlockId(blockId);
  if (!id) throw new Error("无效 blockId");
  payload = payload || {};
  var wantTags = (payload.tags || []).map(function (t) {
    return String(t || "").replace(/^#/, "").trim();
  }).filter(function (t) { return t && t !== DF_TAG; });
  var text = dfStripInlineTagText(payload.text != null ? String(payload.text) : "", wantTags);

  await dfWithEditor(async function () {
    await dfEditorCommand("core.editor.setBlocksContent", null, [{
      id: id,
      content: text ? [{ t: "t", v: text }] : [{ t: "t", v: "" }]
    }], false);
    var block = await dfGetBlock(id);
    var have = {};
    dfTagsOf(block || {}).forEach(function (t) { have[t] = true; });
    for (var i = 0; i < wantTags.length; i++) {
      if (!have[wantTags[i]]) {
        try { await dfEditorCommand("core.editor.insertTag", null, id, wantTags[i]); } catch (e) { /* ignore */ }
      }
    }
  });

  var patch = {
    location: payload.location || "",
    images: Array.isArray(payload.images) ? payload.images.filter(Boolean).slice(0, 9) : []
  };
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
  hasTag: dfHasTag
};

globalThis.__DF_ORCA_BLOCKS = OrcaBlocks;

module.exports=globalThis.__DF_ORCA_BLOCKS;
