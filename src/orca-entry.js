// ============================================================
// src/orca-entry.js — Orca Note 适配层（日记流 orca-diaryflow）
// 日记流只作展示；新建/编辑一律跳转虎鲸块编辑器
// ============================================================

var ORCA_PANEL_TYPE = "orca-diaryflow.panel";
var ORCA_BTN_ID = "orca-diaryflow.button";
var ORCA_SIDETOOL_ID = "orca-diaryflow.sidetool";
var ORCA_STYLE_ID = "orca-diaryflow-style-v39";
var orcaPluginName = "";
var orcaRegisteredPanel = false;
var orcaReady = false;
var orcaReadyCbs = [];
var orcaMomentsData = null;
var orcaCtx = null;
var orcaThemeObserver = null;
var orcaIsDark = false;
var orcaFeedSyncTimer = null;
var orcaFeedSyncUnsub = null;
var orcaSettingsLocaleUnsub = null;
var orcaSettingsLocale = "";
var orcaAutoCleanupScheduled = false;
var orcaAutoBackupScheduled = false;
var orcaFeedSyncMutedUntil = 0;
var orcaFeedSyncInFlight = false;
var orcaFeedSyncFp = "";
var orcaFeedFocusHandler = null;
var orcaFeedVisHandler = null;
var orcaFeedAllItems = [];
var orcaFeedLimit = 25;
var DF_FILTERS_KEY = "feed-filters";
/** 回收站/归档柜列表每页条数 */
var DF_LIST_PAGE = 50;

/** 把当前筛选状态写入插件数据（重开面板后恢复） */
function orcaPersistFilters() {
  if (!orcaCtx) return;
  try {
    var f = orcaCtx.filters || {};
    dfSetData(DF_FILTERS_KEY, {
      kw: f.kw || "",
      tags: Array.isArray(f.tags) ? f.tags.filter(Boolean).slice(0, 1) : [],
      hasImage: !!f.hasImage,
      hasLocation: !!f.hasLocation,
      pinnedOnly: !!f.pinnedOnly,
      dateFrom: f.dateFrom || "",
      dateTo: f.dateTo || ""
    });
  } catch (e) { /* ignore */ }
}

async function orcaLoadFilters() {
  if (!orcaCtx) return;
  try {
    var v = await dfGetData(DF_FILTERS_KEY);
    if (!v || typeof v !== "object") return;
    orcaCtx.filters.kw = typeof v.kw === "string" ? v.kw : "";
    orcaCtx.filters.tags = Array.isArray(v.tags) ? v.tags.filter(Boolean).slice(0, 1) : [];
    orcaCtx.filters.hasImage = !!v.hasImage;
    orcaCtx.filters.hasLocation = !!v.hasLocation;
    orcaCtx.filters.pinnedOnly = !!v.pinnedOnly;
    orcaCtx.filters.dateFrom = typeof v.dateFrom === "string" ? v.dateFrom : "";
    orcaCtx.filters.dateTo = typeof v.dateTo === "string" ? v.dateTo : "";
  } catch (e) { /* ignore */ }
}

globalThis.__DF_IS_DARK = function () { return orcaIsDark; };

// ---------- 媒体资源层：插件文件区(media/) + blob URL（封面/旧资源） ----------
var DF_MEDIA_PREFIX = "dfasset://media/";
var DF_TRANSPARENT_GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function dfBase64ToBytes(b64) {
  var bin = atob(b64);
  var arr = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
function dfBytesToBase64(bytes) {
  var s = "";
  var chunk = 0x8000;
  for (var i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}
function dfMimeOf(name) {
  var m = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
  var ext = m ? m[1] : "";
  var map = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    webp: "image/webp", bmp: "image/bmp", svg: "image/svg+xml",
    mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
    m4v: "video/x-m4v", ogg: "video/ogg", ogv: "video/ogg"
  };
  return map[ext] || "application/octet-stream";
}
async function dfPluginFileBytes(rel) {
  try {
    var content = await orca.invokeBackend("get-plugin-file", orcaPluginName, rel, "buffer");
    if (content != null) {
      if (content instanceof ArrayBuffer) return new Uint8Array(content);
      if (ArrayBuffer.isView(content)) return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
      if (typeof content === "string" && content.trim().length > 0) {
        var str = content.trim();
        var dm = str.match(/^data:[^,]*;base64,(.*)$/s);
        if (dm) return dfBase64ToBytes(dm[1]);
        if (/^[A-Za-z0-9+/=\s]+$/.test(str)) return dfBase64ToBytes(str.replace(/\s+/g, ""));
      }
    }
  } catch (e) {
    console.warn("[orca-diaryflow] get-plugin-file(buffer) failed", rel, e);
  }
  try {
    var dataUrl = await orca.invokeBackend("read-aichat-image-as-data-url", "./plugins/" + orcaPluginName + "/" + rel);
    if (typeof dataUrl === "string" && dataUrl.indexOf(",") >= 0) {
      var b64 = dataUrl.substring(dataUrl.indexOf(",") + 1);
      if (b64.trim().length > 0) return dfBase64ToBytes(b64);
    }
  } catch (e2) { /* ignore */ }
  return null;
}

/** 仅对「像资源路径」的字符串做仓库解析；正文/昵称绝不能走这里 */
function dfLooksLikeAssetRef(s) {
  if (typeof s !== "string" || !s) return false;
  s = s.trim();
  if (!s || s.length > 512 || /[\n\r]/.test(s)) return false;
  if (/^(https?:|data:|blob:|file:|dfasset:)/i.test(s)) return true;
  if (/^\.\//.test(s) || /^assets[\\/]/i.test(s)) return true;
  if (/^[A-Za-z]:[\\/]/.test(s) || s.startsWith("\\\\")) return true;
  // 仅「看起来像带扩展名的资源文件名」
  if (/^[^\\/:*?"<>|\s]+\.(png|jpe?g|gif|webp|bmp|avif|svg|mp4|mov|webm|m4v)$/i.test(s)) return true;
  return false;
}

function dfResolveDisplaySrc(s) {
  if (typeof s !== "string" || !s) return s;
  if (/^(https?:|data:|blob:)/i.test(s)) return s;
  if (s.startsWith(DF_MEDIA_PREFIX)) return null; // 交给 map / load
  if (!dfLooksLikeAssetRef(s)) return s;
  try {
    var fn = (globalThis.__DF_ORCA_BLOCKS && globalThis.__DF_ORCA_BLOCKS.resolveOrcaAssetSrc)
      || globalThis.dfResolveOrcaAssetSrc;
    if (typeof fn === "function") {
      var r = fn(s);
      if (r) return r;
    }
  } catch (e) { /* ignore */ }
  return s;
}

var DF_ASSETS = {
  map: new Map(),
  loading: new Map(),
  resolve(s) {
    if (typeof s !== "string" || !s) return s;
    if (s.startsWith(DF_MEDIA_PREFIX)) {
      var u = this.map.get(s);
      return u || DF_TRANSPARENT_GIF;
    }
    if (!dfLooksLikeAssetRef(s)) return s;
    var vault = dfResolveDisplaySrc(s);
    return vault == null ? s : vault;
  },
  async load(ref) {
    if (this.map.has(ref)) return this.map.get(ref);
    if (this.loading.has(ref)) return this.loading.get(ref);
    var self = this;
    var p = (async () => {
      if (typeof ref === "string" && !ref.startsWith(DF_MEDIA_PREFIX)) {
        if (!dfLooksLikeAssetRef(ref)) return null;
        var direct = dfResolveDisplaySrc(ref);
        if (direct && /^(file:|https?:|data:|blob:)/i.test(direct)) {
          self.map.set(ref, direct);
          return direct;
        }
        return null;
      }
      var rel = "media/" + ref.slice(DF_MEDIA_PREFIX.length);
      var bytes = await dfPluginFileBytes(rel);
      if (!bytes || !bytes.byteLength) {
        // 插件 media 读不到时：尝试当前仓库 assets 同名文件（换库后常见）
        var fname = ref.slice(DF_MEDIA_PREFIX.length);
        if (dfLooksLikeAssetRef("./" + fname) || /\.[a-z0-9]+$/i.test(fname)) {
          var fb = dfResolveDisplaySrc("./" + fname) || dfResolveDisplaySrc("./assets/" + fname);
          if (fb && /^file:/i.test(fb)) {
            self.map.set(ref, fb);
            return fb;
          }
        }
        return null;
      }
      var blob = new Blob([bytes], { type: dfMimeOf(rel) });
      var url = URL.createObjectURL(blob);
      self.map.set(ref, url);
      return url;
    })();
    this.loading.set(ref, p);
    try { return await p; } finally { this.loading.delete(ref); }
  },
  async hydrate(data) {
    var refs = new Set();
    var cfg = (data && data.config) || {};
    [cfg.avatar, cfg.cover, cfg.lockBg].forEach(function (s) {
      if (typeof s !== "string" || !s) return;
      if (s.startsWith(DF_MEDIA_PREFIX) || dfLooksLikeAssetRef(s)) refs.add(s);
    });
    ((data && data.items) || []).forEach(function (it) {
      (it.images || []).forEach(function (s) {
        if (typeof s === "string" && s.startsWith(DF_MEDIA_PREFIX)) refs.add(s);
      });
    });
    await Promise.all(Array.from(refs).map((r) => this.load(r).catch(() => null)));
  },
  async save(file, name) {
    var rel = "media/" + name;
    var buf = await file.arrayBuffer();
    try {
      await orca.invokeBackend("set-plugin-file", orcaPluginName, rel, buf);
    } catch (e1) {
      await orca.invokeBackend("set-plugin-file", orcaPluginName, rel, dfBytesToBase64(new Uint8Array(buf)), "base64");
    }
    var ref = DF_MEDIA_PREFIX + name;
    this.map.set(ref, URL.createObjectURL(file));
    return ref;
  },
  async listMedia() {
    try {
      var r = await orca.invokeBackend("list-plugin-files", orcaPluginName, "media");
      var arr = Array.isArray(r) ? r : (r && (r.files || r.data));
      if (arr) {
        return arr.map(function (x) { return typeof x === "string" ? x : (x && (x.name || x.path)) || ""; })
          .filter(function (n) { return n && String(n).indexOf("/") < 0; });
      }
    } catch (e) { /* ignore */ }
    return [];
  },
  async toDataUrl(ref) {
    if (typeof ref !== "string" || !ref.startsWith(DF_MEDIA_PREFIX)) return ref || "";
    var bytes = await dfPluginFileBytes("media/" + ref.slice(DF_MEDIA_PREFIX.length));
    if (!bytes || !bytes.byteLength) return ref;
    return "data:" + dfMimeOf(ref) + ";base64," + dfBytesToBase64(bytes);
  },
  dispose() {
    this.map.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} });
    this.map.clear();
  }
};
globalThis.__DF_ASSETS = DF_ASSETS;

async function dfGetData(key) {
  var v = await orca.plugins.getData(orcaPluginName, key);
  if (v == null) return null;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch (e) { return v; }
  }
  return v;
}
async function dfSetData(key, val) {
  var s = val == null ? null : (typeof val === "string" ? val : JSON.stringify(val));
  await orca.plugins.setData(orcaPluginName, key, s);
}

var orcaShim = {
  isMobile: false,
  async loadData(key) {
    var v = await dfGetData(key);
    if (typeof v === "string") {
      try { return JSON.parse(v); } catch (e) { return null; }
    }
    return v;
  },
  async saveData(key, val) {
    await dfSetData(key, val);
  }
};

function orcaShowMessage(m) {
  var msg = dfT(m);
  try { orca.notify("info", msg); } catch (e) { console.log("[orca-diaryflow]", msg); }
}

var storage = require_storage();
var render = require_render();
var editor = require_editor();
var OrcaBlocks = globalThis.__DF_ORCA_BLOCKS;

function orcaOpenInOrca(blockId, opts) {
  var id = typeof blockId === "number" ? blockId : Number(blockId);
  if (!id || !isFinite(id)) {
    orcaShowMessage("无效的日记块 ID");
    return;
  }
  return OrcaBlocks.openEntry(id, null, opts || null);
}

/** 新建：插一条带 #日记流 的空块，再打开虎鲸编辑（光标在标签前） */
async function orcaStartNewEntryInOrca(ctx) {
  if (!OrcaBlocks) return;
  try {
    orcaMuteFeedSync(3500);
    var now = new Date();
    var block = await OrcaBlocks.createEntry({
      date: now,
      text: "",
      tags: [],
      focusBeforeTags: true
    });
    var id = block && block.id;
    await orcaRefreshFeed();
    if (ctx && typeof ctx.reApp === "function") ctx.reApp();
    if (id) {
      // reApp 可能抢焦点，再钉一次光标到标签前
      try {
        await OrcaBlocks.openEntry(id, null, { cursorBeforeTags: true, date: now });
      } catch (e2) { /* ignore */ }
      orcaShowMessage("已新建，请在虎鲸中编辑");
    } else {
      orcaShowMessage("已创建条目，请到今日日记继续编辑");
    }
  } catch (e) {
    console.error("[orca-diaryflow] new entry", e);
    orca.notify("error", dfT("新建失败: ") + (e && e.message || e), { title: dfT("日记流") });
  }
}

var ORCA_MOODS = ["", "😀", "🙂", "😐", "😔", "😡", "😴", "🤒"];

function orcaParseTags(s) {
  return String(s || "").split(/[\s,，、#]+/).map(function (t) { return t.trim(); })
    .filter(function (t) { return t && t !== "日记流"; });
}

function orcaComposeTemplates() {
  var en = dfLocaleIsEn();
  return [
    { id: "blank", label: en ? "Blank" : "空白", text: "" },
    { id: "three", label: en ? "Three things" : "今天的三件事", text: en ? "Three things today:\n1. \n2. \n3. " : "今天的三件事：\n1. \n2. \n3. " },
    { id: "gratitude", label: en ? "Gratitude" : "感恩", text: en ? "Grateful for:\n- " : "今天想感谢：\n- " },
    { id: "review", label: en ? "Review" : "复盘", text: en ? "What went well:\n- \nTo improve:\n- " : "做得好的：\n- \n可以改进：\n- " },
    { id: "travel", label: en ? "Travel" : "行程", text: en ? "Where:\nWhat happened:\n" : "地点：\n行程：\n" }
  ];
}

var DF_TPL_KEY = "compose-templates";

function orcaNormalizeCustomTemplates(v) {
  if (!Array.isArray(v)) return [];
  return v.filter(function (t) { return t && typeof t.text === "string"; })
    .map(function (t) { return { label: String(t.label || dfT("自定义模板")).slice(0, 40), text: String(t.text) }; })
    .slice(0, 50);
}

async function orcaLoadComposeTemplates() {
  try {
    var v = await dfGetData(DF_TPL_KEY);
    if (Array.isArray(v)) return { custom: orcaNormalizeCustomTemplates(v), hidden: [] };
    if (v && typeof v === "object") {
      return {
        custom: orcaNormalizeCustomTemplates(v.custom),
        hidden: Array.isArray(v.hidden) ? v.hidden.filter(function (x) { return typeof x === "string"; }).slice(0, 50) : []
      };
    }
  } catch (e) { /* ignore */ }
  return { custom: [], hidden: [] };
}

async function orcaSaveComposeTemplates(state) {
  state = state || {};
  try {
    await dfSetData(DF_TPL_KEY, {
      custom: (state.custom || []).slice(0, 50),
      hidden: (state.hidden || []).slice(0, 50)
    });
  } catch (e) { /* ignore */ }
}

/** 面板内快速撰写：文字 / 图片 / 标签 / 时间 / 心情天气 → 创建到今日日记 */
function orcaOpenComposeDialog(ctx) {
  if (!OrcaBlocks) return;
  var files = [];
  var objectUrls = [];
  var overlay = document.createElement("div");
  overlay.className = "mom-overlay orca-df-compose-overlay";
  var moodOpts = ORCA_MOODS.map(function (m) {
    return '<option value="' + orcaEsc(m) + '">' + (m || dfT("心情")) + "</option>";
  }).join("");
  overlay.innerHTML =
    '<div class="mom-modal orca-df-compose-modal">' +
      '<div class="mom-modal-head"><span>' + dfT("新建日记") + '</span><button type="button" class="mom-modal-x" data-x>×</button></div>' +
      '<div class="mom-modal-body">' +
        '<div class="orca-df-compose-tplrow">' +
          '<select class="mom-inp orca-df-compose-tpl" data-template><option value="">' + orcaEsc(dfT("模板")) + "</option></select>" +
          '<button type="button" class="mom-btn mom-btn-small" data-tpl-save>' + dfT("保存为模板") + "</button>" +
          '<button type="button" class="mom-btn mom-btn-small" data-tpl-del hidden>' + dfT("删除模板") + "</button>" +
        "</div>" +
        '<div class="orca-df-compose-tplsave" hidden>' +
          '<input type="text" class="mom-inp" data-tpl-name maxlength="40" placeholder="' + orcaEsc(dfT("模板名称")) + '">' +
          '<button type="button" class="mom-btn mom-btn-small" data-tpl-confirm>' + dfT("保存") + "</button>" +
          '<button type="button" class="mom-btn mom-btn-small" data-tpl-cancel>' + dfT("取消") + "</button>" +
        "</div>" +
        '<div class="orca-df-compose-toolbar">' +
          '<button type="button" data-fmt="b" title="' + orcaEsc(dfT("粗体")) + '"><b>B</b></button>' +
          '<button type="button" data-fmt="i" title="' + orcaEsc(dfT("斜体")) + '"><i>I</i></button>' +
          '<button type="button" data-fmt="s" title="' + orcaEsc(dfT("删除线")) + '"><s>S</s></button>' +
          '<button type="button" data-fmt="u" title="' + orcaEsc(dfT("下划线")) + '"><u>U</u></button>' +
          '<button type="button" data-fmt="c" title="' + orcaEsc(dfT("行内代码")) + '">&lt;/&gt;</button>' +
          '<button type="button" data-fmt="mark" title="' + orcaEsc(dfT("高亮")) + '">==</button>' +
          '<button type="button" data-fmt="link" title="' + orcaEsc(dfT("链接")) + '">🔗</button>' +
        "</div>" +
        '<textarea class="mom-inp orca-df-compose-text" data-text rows="4" placeholder="' + orcaEsc(dfT("写点什么…")) + '"></textarea>' +
        '<div class="orca-df-compose-imgs" data-imgs></div>' +
        '<div class="orca-df-compose-row">' +
          '<button type="button" class="mom-btn mom-btn-small" data-add-img>' + dfT("添加图片") + "</button>" +
          '<input type="file" accept="image/*" multiple hidden data-file>' +
        "</div>" +
        '<input type="text" class="mom-inp" data-tags placeholder="' + orcaEsc(dfT("标签（空格/逗号分隔）")) + '" maxlength="200">' +
        '<div class="orca-df-compose-row">' +
          '<input type="datetime-local" class="mom-inp" data-date value="' + orcaEsc(orcaToDatetimeLocalValue(Date.now())) + '">' +
          '<select class="mom-inp orca-df-compose-mood" data-mood>' + moodOpts + "</select>" +
          '<input type="text" class="mom-inp orca-df-compose-weather" data-weather placeholder="' + orcaEsc(dfT("天气")) + '" maxlength="20">' +
          '<input type="text" class="mom-inp orca-df-compose-loc" data-loc placeholder="' + orcaEsc(dfT("地点")) + '" maxlength="80">' +
        "</div>" +
      "</div>" +
      '<div class="mom-modal-foot">' +
        '<button type="button" class="mom-btn" data-x>' + dfT("取消") + "</button>" +
        '<button type="button" class="mom-btn" data-publish>' + dfT("发布") + "</button>" +
        '<button type="button" class="mom-btn mom-btn-primary" data-publish-open>' + dfT("发布并打开") + "</button>" +
      "</div>" +
    "</div>";
  dfMountDialog(overlay);
  var ta = overlay.querySelector("[data-text]");
  var tplSel = overlay.querySelector("[data-template]");
  var tplDelBtn = overlay.querySelector("[data-tpl-del]");
  var tplSaveRow = overlay.querySelector(".orca-df-compose-tplsave");
  var tplNameInp = overlay.querySelector("[data-tpl-name]");
  var customT = [];
  var hiddenBuiltins = [];
  var imgsEl = overlay.querySelector("[data-imgs]");
  var fileInput = overlay.querySelector("[data-file]");
  var tagsInp = overlay.querySelector("[data-tags]");
  var dateInp = overlay.querySelector("[data-date]");
  var moodSel = overlay.querySelector("[data-mood]");
  var weatherInp = overlay.querySelector("[data-weather]");
  var locInp = overlay.querySelector("[data-loc]");
  var busy = false;

  function renderImgs() {
    if (!files.length) { imgsEl.innerHTML = ""; return; }
    imgsEl.innerHTML = files.map(function (f, i) {
      return '<div class="orca-df-compose-img"><img src="' + orcaEsc(f.__url) + '" alt="">' +
        '<button type="button" class="orca-df-compose-img-x" data-rm-img="' + i + '" aria-label="' + orcaEsc(dfT("删除")) + '">×</button></div>';
    }).join("");
  }
  function revokeAll() {
    objectUrls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) { /* ignore */ } });
    objectUrls = [];
  }
  function close() {
    try { overlay.remove(); } catch (e) { /* ignore */ }
    revokeAll();
  }
  function applyFmt(kind) {
    if (!ta) return;
    var s = ta.selectionStart, e = ta.selectionEnd, val = ta.value;
    var sel = val.slice(s, e);
    function wrap(before, after) {
      ta.value = val.slice(0, s) + before + sel + after + val.slice(e);
      ta.focus();
      var a = s + before.length, b = a + sel.length;
      try { ta.setSelectionRange(a, b); } catch (eS) { /* ignore */ }
    }
    if (kind === "b") wrap("**", "**");
    else if (kind === "i") wrap("*", "*");
    else if (kind === "s") wrap("~~", "~~");
    else if (kind === "u") wrap("__", "__");
    else if (kind === "c") wrap("`", "`");
    else if (kind === "mark") wrap("==", "==");
    else if (kind === "link") {
      if (sel) {
        ta.value = val.slice(0, s) + "[" + sel + "](url)" + val.slice(e);
        ta.focus();
        var up = s + 1 + sel.length + 2;
        try { ta.setSelectionRange(up, up + 3); } catch (eL) { /* ignore */ }
      } else {
        ta.value = val.slice(0, s) + "[](url)" + val.slice(e);
        ta.focus();
        try { ta.setSelectionRange(s + 1, s + 1); } catch (eL2) { /* ignore */ }
      }
    }
  }

  async function submit(openAfter) {
    if (busy) return;
    busy = true;
    try {
      orcaMuteFeedSync(3500);
      var d = dateInp.value ? new Date(dateInp.value) : new Date();
      if (isNaN(d.getTime())) d = new Date();
      var block = await OrcaBlocks.createEntry({
        date: d,
        text: ta.value || "",
        tags: orcaParseTags(tagsInp.value),
        images: files.map(function (f) { return f.__url; }),
        location: String(locInp && locInp.value || "").trim()
      });
      var id = block && block.id;
      var mood = moodSel.value || "";
      var weather = String(weatherInp.value || "").trim();
      if (id && (mood || weather) && OrcaBlocks.updateEntryMeta) {
        try { await OrcaBlocks.updateEntryMeta(id, { mood: mood, weather: weather }); } catch (eM) { /* ignore */ }
      }
      revokeAll();
      try { overlay.remove(); } catch (e) { /* ignore */ }
      await orcaRefreshFeed();
      if (ctx && typeof ctx.reApp === "function") ctx.reApp();
      orcaShowMessage("已发布");
      if (openAfter && id) {
        try { await OrcaBlocks.openEntry(id, null, { date: d }); } catch (eO) { orcaOpenInOrca(id); }
      }
    } catch (e) {
      console.error("[orca-diaryflow] compose", e);
      orca.notify("error", dfT("发布失败: ") + (e && e.message || e), { title: dfT("日记流") });
      busy = false;
    }
  }
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay || e.target.closest("[data-x]")) { close(); return; }
    var fmtBtn = e.target.closest("[data-fmt]");
    if (fmtBtn) { applyFmt(fmtBtn.getAttribute("data-fmt")); return; }
    if (e.target.closest("[data-add-img]")) { fileInput.click(); return; }
    if (e.target.closest("[data-publish-open]")) { submit(true); return; }
    if (e.target.closest("[data-publish]")) { submit(false); return; }
    if (e.target.closest("[data-tpl-save]")) {
      if (tplSaveRow) {
        tplSaveRow.hidden = false;
        if (tplNameInp) { tplNameInp.value = ""; try { tplNameInp.focus(); } catch (eF) { /* ignore */ } }
      }
      return;
    }
    if (e.target.closest("[data-tpl-cancel]")) { if (tplSaveRow) tplSaveRow.hidden = true; return; }
    if (e.target.closest("[data-tpl-confirm]")) {
      var tplName = (tplNameInp && tplNameInp.value ? String(tplNameInp.value).trim() : "") || dfT("自定义模板");
      var tplBody = ta ? String(ta.value || "") : "";
      if (!tplBody.trim()) { orcaShowMessage("模板内容为空"); return; }
      customT.push({ label: tplName.slice(0, 40), text: tplBody });
      orcaSaveComposeTemplates({ custom: customT, hidden: hiddenBuiltins }).then(refreshTpl);
      if (tplSaveRow) tplSaveRow.hidden = true;
      orcaShowMessage("已保存模板");
      return;
    }
    if (e.target.closest("[data-tpl-del]")) {
      var ref = selectedRef();
      if (!ref) return;
      if (ref.type === "builtin") {
        if (hiddenBuiltins.indexOf(ref.id) < 0) hiddenBuiltins.push(ref.id);
      } else {
        customT.splice(ref.index, 1);
      }
      orcaSaveComposeTemplates({ custom: customT, hidden: hiddenBuiltins }).then(refreshTpl);
      orcaShowMessage("已删除模板");
      return;
    }
    var rm = e.target.closest("[data-rm-img]");
    if (rm) {
      var i = Number(rm.getAttribute("data-rm-img"));
      if (isFinite(i) && files[i]) {
        try { URL.revokeObjectURL(files[i].__url); } catch (e2) { /* ignore */ }
        files.splice(i, 1);
        objectUrls = files.map(function (f) { return f.__url; });
        renderImgs();
      }
    }
  });
  overlay.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(false); }
  });
  fileInput.addEventListener("change", function () {
    var picked = Array.prototype.slice.call(fileInput.files || []);
    fileInput.value = "";
    picked.forEach(function (f) {
      if (files.length >= 9) return;
      f.__url = URL.createObjectURL(f);
      objectUrls.push(f.__url);
      files.push(f);
    });
    renderImgs();
  });
  function selectedRef() {
    var v = tplSel ? String(tplSel.value || "") : "";
    if (v.indexOf("b:") === 0) return { type: "builtin", id: v.slice(2) };
    if (v.indexOf("c:") === 0) {
      var i = Number(v.slice(2));
      return isFinite(i) ? { type: "custom", index: i } : null;
    }
    return null;
  }
  function refreshTpl() {
    if (!tplSel) return;
    var opts = '<option value="">' + orcaEsc(dfT("模板")) + "</option>";
    orcaComposeTemplates().forEach(function (t) {
      if (hiddenBuiltins.indexOf(t.id) >= 0) return;
      opts += '<option value="b:' + t.id + '">' + orcaEsc(t.label) + "</option>";
    });
    customT.forEach(function (t, i) {
      opts += '<option value="c:' + i + '">' + orcaEsc(t.label) + "</option>";
    });
    tplSel.innerHTML = opts;
    tplSel.value = "";
    if (tplDelBtn) tplDelBtn.hidden = true;
  }
  if (tplSel) {
    // 注意：不要在原生 select 的 change 里同步弹 confirm/prompt（Electron 会死锁），
    // 也不要在事件分发中直接改 DOM，统一延后到下一个 tick。
    tplSel.addEventListener("change", function () {
      var ref = selectedRef();
      // 内置 / 自定义模板均可删除；选中后按钮保持可见
      if (tplDelBtn) tplDelBtn.hidden = !ref;
      if (!ref || !ta) return;
      var text = "";
      if (ref.type === "builtin") {
        var bt = orcaComposeTemplates().filter(function (t) { return t.id === ref.id; })[0];
        text = bt ? bt.text : "";
      } else {
        text = customT[ref.index] ? customT[ref.index].text : "";
      }
      if (!text) return;
      setTimeout(function () {
        ta.value = text;
        try { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } catch (eF) { /* ignore */ }
      }, 0);
    });
  }
  orcaLoadComposeTemplates().then(function (st) {
    if (!overlay.isConnected) return;
    customT = (st && st.custom) || [];
    hiddenBuiltins = (st && st.hidden) || [];
    refreshTpl();
  });
  if (ta) { try { ta.focus(); } catch (eF) { /* ignore */ } }
}

/** 编辑已有条目的心情 / 天气 */
function orcaChangeEntryMeta(ctx, it) {
  if (!it || !OrcaBlocks || !OrcaBlocks.updateEntryMeta) return;
  var bid = it.blockId || Number(it.id);
  if (!bid || !isFinite(Number(bid))) { orcaShowMessage("找不到对应虎鲸块"); return; }
  var overlay = document.createElement("div");
  overlay.className = "mom-overlay orca-df-meta-overlay";
  var moodOpts = ORCA_MOODS.map(function (m) {
    return '<option value="' + orcaEsc(m) + '"' + (String(it.mood || "") === m ? " selected" : "") + ">" + (m || dfT("心情")) + "</option>";
  }).join("");
  overlay.innerHTML =
    '<div class="mom-modal mom-modal-sm">' +
      '<div class="mom-modal-head"><span>' + dfT("心情 / 天气") + '</span><button type="button" class="mom-modal-x" data-x>×</button></div>' +
      '<div class="mom-modal-body">' +
        '<label class="orca-df-tools-label">' + dfT("心情") + '</label>' +
        '<select class="mom-inp" data-mood>' + moodOpts + "</select>" +
        '<label class="orca-df-tools-label">' + dfT("天气") + '</label>' +
        '<input type="text" class="mom-inp" data-weather maxlength="20" value="' + orcaEsc(it.weather || "") + '">' +
      "</div>" +
      '<div class="mom-modal-foot">' +
        '<button type="button" class="mom-btn" data-x>' + dfT("取消") + "</button>" +
        '<button type="button" class="mom-btn mom-btn-primary" data-save>' + dfT("确定") + "</button>" +
      "</div>" +
    "</div>";
  dfMountDialog(overlay);
  var moodSel = overlay.querySelector("[data-mood]");
  var weatherInp = overlay.querySelector("[data-weather]");
  function close() { try { overlay.remove(); } catch (e) { /* ignore */ } }
  function save() {
    orcaMuteFeedSync(2500);
    var mood = moodSel ? moodSel.value : "";
    var weather = String(weatherInp && weatherInp.value || "").trim();
    OrcaBlocks.updateEntryMeta(bid, { mood: mood, weather: weather }).then(function () {
      it.mood = mood;
      it.weather = weather;
      return orcaRefreshFeed({ keepLimit: true, skipHeal: true, preferLive: true });
    }).then(function () {
      if (ctx && typeof ctx.reApp === "function") ctx.reApp();
      orcaShowMessage("已更新");
      close();
    }).catch(function (e) {
      console.warn("[orca-diaryflow] meta", e);
      orcaShowMessage("更新失败");
    });
  }
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay || e.target.closest("[data-x]")) close();
    else if (e.target.closest("[data-save]")) save();
  });
}

function orcaMuteFeedSync(ms) {
  var until = Date.now() + Math.max(0, Number(ms) || 0);
  if (until > orcaFeedSyncMutedUntil) orcaFeedSyncMutedUntil = until;
}

function orcaFeedFingerprint(items) {
  return (items || []).map(function (it) {
    if (!it) return "";
    return [
      it.id,
      it.blockId || "",
      it.text || "",
      (it.tags || []).join(","),
      (it.images || []).join("|"),
      it.location || "",
      it.pinned ? 1 : 0,
      it.archived ? 1 : 0,
      (it.comments && it.comments.length) || 0
    ].join("\u0001");
  }).join("\u0002");
}

/** 是否正在虎鲸编辑器内输入（此时禁止动 blocks 缓存） */
function orcaIsEditingInOrca() {
  try {
    var el = document.activeElement;
    if (!el) return false;
    if (el.isContentEditable) return true;
    var tag = (el.tagName || "").toLowerCase();
    if (tag === "textarea" || tag === "input") {
      // 日记流自己的搜索框不算
      if (el.closest && el.closest(".orca-df-scope")) return false;
      return true;
    }
    if (el.closest && el.closest(".orca-block-editor, .tiptap, [data-orca-editor], .ProseMirror")) {
      return true;
    }
  } catch (e) { /* ignore */ }
  return false;
}

function orcaScheduleFeedSync() {
  if (!orcaReady) return;
  if (!orcaCtx || !orcaCtx.mounts || !orcaCtx.mounts.length) return;
  if (Date.now() < orcaFeedSyncMutedUntil) return;
  if (orcaIsEditingInOrca()) {
    // 编辑中延后，避免删缓存/覆盖导致光标与滚动跳动
    if (orcaFeedSyncTimer) clearTimeout(orcaFeedSyncTimer);
    orcaFeedSyncTimer = setTimeout(function () {
      orcaFeedSyncTimer = null;
      orcaScheduleFeedSync();
    }, 1600);
    return;
  }
  if (orcaFeedSyncTimer) clearTimeout(orcaFeedSyncTimer);
  orcaFeedSyncTimer = setTimeout(function () {
    orcaFeedSyncTimer = null;
    orcaRunFeedSync().catch(function (e) {
      console.warn("[orca-diaryflow] feed sync", e);
    });
  }, 1200);
}

async function orcaRunFeedSync() {
  if (!orcaReady || !OrcaBlocks) return;
  // 无已挂载面板时无需重建（后台块变化不触发全量刷新）
  if (!orcaCtx || !orcaCtx.mounts || !orcaCtx.mounts.length) return;
  if (Date.now() < orcaFeedSyncMutedUntil) return;
  if (orcaIsEditingInOrca()) {
    orcaScheduleFeedSync();
    return;
  }
  if (orcaFeedSyncInFlight) {
    orcaScheduleFeedSync();
    return;
  }
  orcaFeedSyncInFlight = true;
  orcaMuteFeedSync(1200);
  try {
    var prev = orcaFeedSyncFp || orcaFeedFingerprint(orcaMomentsData && orcaMomentsData.items);
    // 禁止 delete orca.state.blocks：会让正在编辑的块编辑器重挂载/跳动
    await orcaRefreshFeed({ skipHeal: true, preferLive: true });
    var next = orcaFeedFingerprint(orcaMomentsData && orcaMomentsData.items);
    orcaFeedSyncFp = next;
    if (next !== prev && orcaCtx && orcaCtx.mounts && orcaCtx.mounts.length) {
      orcaCtx.reApp();
    }
  } finally {
    orcaFeedSyncInFlight = false;
  }
}

function orcaGetValtioSubscribe() {
  try {
    var V = globalThis.Valtio || (typeof window !== "undefined" ? window.Valtio : null);
    if (V && typeof V.subscribe === "function") return V.subscribe.bind(V);
  } catch (e) { /* ignore */ }
  return null;
}

function orcaStartFeedSyncWatch() {
  orcaStopFeedSyncWatch();
  var sub = orcaGetValtioSubscribe();
  if (sub && orca.state && orca.state.blocks) {
    try {
      orcaFeedSyncUnsub = sub(orca.state.blocks, function () {
        orcaScheduleFeedSync();
      });
    } catch (e) {
      console.warn("[orca-diaryflow] valtio subscribe failed", e);
      orcaFeedSyncUnsub = null;
    }
  }
  orcaFeedFocusHandler = function () {
    if (document.hidden) return;
    orcaScheduleFeedSync();
  };
  orcaFeedVisHandler = function () {
    if (!document.hidden) orcaScheduleFeedSync();
  };
  try { window.addEventListener("focus", orcaFeedFocusHandler); } catch (e2) { /* ignore */ }
  try { document.addEventListener("visibilitychange", orcaFeedVisHandler); } catch (e3) { /* ignore */ }
}

/** 启动后按设置自动清理未引用的插件图片（默认关闭；回收站/归档引用受保护） */
function orcaScheduleAutoMediaCleanup() {
  if (orcaAutoCleanupScheduled) return;
  orcaAutoCleanupScheduled = true;
  try {
    if (!dfGetSetting("autoCleanImages")) return;
  } catch (e0) { return; }
  setTimeout(function () {
    if (orcaIsEditingInOrca()) return;
    if (typeof orcaToolsListOrphanMedia !== "function" || typeof orcaToolsCleanupOrphanMedia !== "function") return;
    orcaToolsListOrphanMedia().then(function (names) {
      if (!names || !names.length) return null;
      return orcaToolsCleanupOrphanMedia(names).then(function (removed) {
        if (removed) console.log("[orca-diaryflow] auto cleaned orphan images:", removed);
      });
    }).catch(function () { /* ignore */ });
  }, 20000);
}

/** 启动后按设置自动备份（每天一次，文件名按日期，自动保留 N 份） */
function orcaScheduleAutoBackup() {
  if (orcaAutoBackupScheduled) return;
  orcaAutoBackupScheduled = true;
  try {
    if (!dfGetSetting("autoBackup")) return;
  } catch (e0) { return; }
  setTimeout(function () {
    if (typeof orcaToolsWriteBackupFile !== "function") return;
    orcaToolsWriteBackupFile().then(function (r) {
      console.log("[orca-diaryflow] auto backup:", r && r.name, r && r.count);
    }).catch(function (e) {
      console.warn("[orca-diaryflow] auto backup failed", e);
    });
  }, 30000);
}

/** 监听语言切换：重注册设置页标签（中/英）并刷新主题 */
function orcaWatchLocale() {
  orcaSettingsLocale = String((orca.state && orca.state.locale) || "");
  if (orcaSettingsLocaleUnsub) {
    try { orcaSettingsLocaleUnsub(); } catch (e0) { /* ignore */ }
    orcaSettingsLocaleUnsub = null;
  }
  var sub = orcaGetValtioSubscribe();
  if (!sub || !orca.state) return;
  try {
    orcaSettingsLocaleUnsub = sub(orca.state, function () {
      var loc = String((orca.state && orca.state.locale) || "");
      if (loc === orcaSettingsLocale) return;
      orcaSettingsLocale = loc;
      dfRegisterSettings().catch(function () { /* ignore */ });
      orcaApplyTheme();
    });
  } catch (e) {
    console.warn("[orca-diaryflow] locale watch failed", e);
    orcaSettingsLocaleUnsub = null;
  }
}

function orcaStopFeedSyncWatch() {
  if (orcaFeedSyncTimer) {
    clearTimeout(orcaFeedSyncTimer);
    orcaFeedSyncTimer = null;
  }
  if (typeof orcaFeedSyncUnsub === "function") {
    try { orcaFeedSyncUnsub(); } catch (e) { /* ignore */ }
  }
  orcaFeedSyncUnsub = null;
  if (orcaFeedFocusHandler) {
    try { window.removeEventListener("focus", orcaFeedFocusHandler); } catch (e2) { /* ignore */ }
    orcaFeedFocusHandler = null;
  }
  if (orcaFeedVisHandler) {
    try { document.removeEventListener("visibilitychange", orcaFeedVisHandler); } catch (e3) { /* ignore */ }
    orcaFeedVisHandler = null;
  }
}

async function orcaRefreshFeed(opts) {
  if (!OrcaBlocks) return;
  opts = opts || {};
  // 默认 skipHeal=true：读路径不改库
  var skipHeal = opts.skipHeal !== false;
  orcaMuteFeedSync(skipHeal ? 800 : 1200);
  var kw = (orcaCtx && orcaCtx.filters && orcaCtx.filters.kw) || "";
  var tagFilters = (orcaCtx && orcaCtx.filters && orcaCtx.filters.tags) || [];
  var preferLive = opts.preferLive;
  if (preferLive == null) preferLive = skipHeal;
  var feed = await OrcaBlocks.listFeed({
    kw: kw,
    tags: tagFilters,
    skipHeal: skipHeal,
    preferLive: preferLive === true,
    freezeState: !!opts.freezeState,
    fullText: !!opts.fullText
  });
  var idx = feed.index || {};
  var prevCfg = (orcaMomentsData && orcaMomentsData.config) || {};
  var cfg = Object.assign({}, storage.defaultData().config, idx.config || {});
  // 索引尚未写入的头像/封面：保留内存值，避免自动同步冲掉刚上传未落盘的配置
  if (!cfg.avatar && prevCfg.avatar) cfg.avatar = prevCfg.avatar;
  if (!cfg.cover && prevCfg.cover) cfg.cover = prevCfg.cover;
  if (!cfg.lockBg && prevCfg.lockBg) cfg.lockBg = prevCfg.lockBg;
  if (!cfg.nickname && prevCfg.nickname) cfg.nickname = prevCfg.nickname;
  if (cfg.signature == null && prevCfg.signature != null) cfg.signature = prevCfg.signature;
  orcaFeedAllItems = feed.items || [];
  (orcaFeedAllItems || []).forEach(function (it) {
    if (!it) return;
    it.text = OrcaBlocks.stripInlineTagText(it.text || "", it.tags || []);
  });
  if (!opts.keepLimit) orcaFeedLimit = dfFeedPageSize();
  orcaApplyFeedWindow(cfg);
  try { await DF_ASSETS.hydrate(orcaMomentsData); } catch (e) { /* ignore */ }
  orcaFeedSyncFp = orcaFeedFingerprint(orcaFeedAllItems);
  // 旧 overlay 评论迁到虎鲸子块（后台，不挡首屏）
  orcaScheduleCommentMigrate();
  return orcaMomentsData;
}

function orcaApplyFeedWindow(cfg) {
  var all = orcaFeedAllItems || [];
  if (typeof orcaToolsQuickFilterItems === "function" && orcaCtx && orcaCtx.filters) {
    all = orcaToolsQuickFilterItems(all, orcaCtx.filters);
  }
  var page = dfFeedPageSize();
  var limit = Math.max(page, Number(orcaFeedLimit) || page);
  orcaFeedLimit = limit;
  var visible = all.slice(0, limit);
  var prevCfg = (orcaMomentsData && orcaMomentsData.config) || {};
  orcaMomentsData = {
    config: cfg || prevCfg,
    items: visible,
    _allCount: all.length,
    _feedLimit: limit,
    _hasMore: all.length > limit
  };
}

function orcaLoadMoreFeed(ctx) {
  if (!orcaMomentsData || !orcaMomentsData._hasMore) return;
  orcaFeedLimit += dfFeedPageSize();
  orcaApplyFeedWindow(orcaMomentsData.config);
  DF_ASSETS.hydrate(orcaMomentsData).then(function () {
    if (ctx && typeof ctx.reApp === "function") ctx.reApp();
  }).catch(function () {
    if (ctx && typeof ctx.reApp === "function") ctx.reApp();
  });
}

var orcaCommentMigrateTimer = null;
function orcaScheduleCommentMigrate() {
  if (orcaCommentMigrateTimer) clearTimeout(orcaCommentMigrateTimer);
  orcaCommentMigrateTimer = setTimeout(function () {
    orcaCommentMigrateTimer = null;
    orcaMigratePendingComments().catch(function (e) {
      console.warn("[orca-diaryflow] comment migrate", e);
    });
  }, 600);
}

async function orcaMigratePendingComments() {
  if (!OrcaBlocks) return;
  var pending = (orcaFeedAllItems || []).filter(function (it) { return it && it.needsCommentMigrate; });
  if (!pending.length) return;
  var changed = false;
  for (var i = 0; i < pending.length; i++) {
    try {
      var r = await OrcaBlocks.migrateEntryComments(pending[i].blockId || pending[i].id);
      if (r && (r.migrated > 0 || r.already > 0)) {
        pending[i].needsCommentMigrate = false;
        changed = true;
      }
    } catch (e) { /* ignore one */ }
  }
  if (changed) {
    await orcaRefreshFeed({ keepLimit: true, skipHeal: true, preferLive: true });
    if (orcaCtx && typeof orcaCtx.reApp === "function") orcaCtx.reApp();
  }
}

/** 手动同步：拉后端最新；编辑中不写回 state，避免跳动 */
async function orcaManualRefreshFeed(ctx) {
  try {
    orcaMuteFeedSync(1500);
    await orcaRefreshFeed({
      skipHeal: true,
      preferLive: false,
      freezeState: orcaIsEditingInOrca()
    });
    if (ctx && typeof ctx.reApp === "function") ctx.reApp();
    orcaShowMessage("日记流已同步");
  } catch (e) {
    console.warn("[orca-diaryflow] manual refresh", e);
    orcaShowMessage("同步失败");
  }
}

function orcaBuildCtx() {
  var c = {
    plugin: orcaShim,
    filters: { kw: "", tags: [], hasImage: false, hasLocation: false, pinnedOnly: false, dateFrom: "", dateTo: "" },
    view: "feed",
    calYear: new Date().getFullYear(),
    mounts: [],
    data: function () { return orcaMomentsData; },
    save: async function () {
      // 配置 + 置顶/点赞/地点写回插件索引；评论主存虎鲸子块，不再覆写 overlay.comments
      await OrcaBlocks.mutateIndex(function (idx) {
        idx.config = (orcaMomentsData && orcaMomentsData.config) || idx.config;
        idx.overlays = idx.overlays || {};
        var saveItems = orcaFeedAllItems && orcaFeedAllItems.length
          ? orcaFeedAllItems
          : ((orcaMomentsData && orcaMomentsData.items) || []);
        saveItems.forEach(function (it) {
          if (!it || !(it.blockId || it.id)) return;
          var key = String(it.blockId || it.id);
          var prev = idx.overlays[key] || {};
          idx.overlays[key] = Object.assign({}, prev, {
            pinned: !!it.pinned,
            archived: !!it.archived,
            location: it.location || "",
            images: Array.isArray(it.images) ? it.images.filter(Boolean).slice(0, 9) : [],
            createdAt: it.createdAt || prev.createdAt || undefined,
            commentsStorage: "orca-blocks"
          });
          if (!idx.overlays[key].archived) delete idx.overlays[key].archived;
          // 已迁到块的评论：清空 overlay 双源；未迁完的保留 prev.comments
          if (it.commentsFromBlocks || !it.needsCommentMigrate) {
            idx.overlays[key].comments = [];
          } else if (Array.isArray(it.comments)) {
            idx.overlays[key].comments = it.comments;
          }
          if (!idx.overlays[key].createdAt) delete idx.overlays[key].createdAt;
        });
      });
      return orcaMomentsData;
    },
    showMessage: orcaShowMessage,
    orcaPanelId: null
  };
  c.reApp = function () {
    ((c.data() && c.data().items) || []).forEach(function (it) {
      if (!it || !OrcaBlocks) return;
      it.text = OrcaBlocks.stripInlineTagText(it.text || "", it.tags || []);
    });
    c.mounts.forEach(function (el) {
      render.renderApp(el, c);
      orcaEnhanceFeedDom(el, c);
    });
  };
  return c;
}

function orcaWhenReady(fn) {
  if (orcaReady) { try { fn(); } catch (e) { console.error(e); } }
  else orcaReadyCbs.push(fn);
}

function orcaEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function orcaCloseTagFilterPopover(ctx) {
  var root = (ctx && ctx.container) || document;
  var pop = root.querySelector && root.querySelector(".orca-df-tag-popover");
  if (!pop && ctx && ctx.container) pop = document.querySelector(".orca-df-tag-popover");
  if (pop) pop.remove();
  if (ctx && ctx.__tagFilterClose) {
    document.removeEventListener("click", ctx.__tagFilterClose, true);
    ctx.__tagFilterClose = null;
  }
}

/** 设标签筛选；再点同一标签则取消。返回是否仍在筛选。 */
function orcaSetTagFilter(ctx, tag) {
  if (!ctx.filters) ctx.filters = { kw: "", tags: [] };
  var cur = (ctx.filters.tags || [])[0] || "";
  var next = tag ? String(tag) : "";
  if (!next || next === cur) {
    ctx.filters.tags = [];
    orcaPersistFilters();
    return false;
  }
  ctx.filters.tags = [next];
  ctx.filters.kw = "";
  orcaPersistFilters();
  return true;
}

function orcaOpenTagFilter(ctx, btn) {
  if (!ctx) return;
  var existing = document.querySelector(".orca-df-tag-popover");
  if (existing) {
    orcaCloseTagFilterPopover(ctx);
    return;
  }
  // 已在标签筛选中：再点 FAB = 取消筛选
  var activeNow = ((ctx.filters && ctx.filters.tags) || [])[0] || "";
  if (activeNow) {
    orcaSetTagFilter(ctx, "");
    orcaRefreshFeed().then(function () {
      if (ctx.reApp) ctx.reApp();
      orcaShowMessage("已取消标签筛选");
    });
    return;
  }
  OrcaBlocks.collectUserTags().then(function (tags) {
    var pop = document.createElement("div");
    pop.className = "orca-df-tag-popover orca-df-scope";
    var active = ((ctx.filters && ctx.filters.tags) || [])[0] || "";
    var rows = '<button type="button" class="orca-df-tag-popover-item' + (!active ? " is-on" : "") + '" data-df-act="clear-tag">' + dfT("全部") + "</button>";
    if (!tags.length) {
      rows += '<div class="orca-df-tag-popover-empty">' + dfT("暂无标签") + "</div>";
    } else {
      rows += tags.map(function (t) {
        var on = active === t ? " is-on" : "";
        return '<button type="button" class="orca-df-tag-popover-item' + on + '" data-df-act="filter-tag" data-tag="' + orcaEsc(t) + '">#' + orcaEsc(t) + "</button>";
      }).join("");
    }
    pop.innerHTML = '<div class="orca-df-tag-popover-title">' + dfT("标签筛选") + "</div>" + rows;
    document.body.appendChild(pop);
    var fabRect = (btn && btn.getBoundingClientRect()) || { left: 0, bottom: 0, top: 0 };
    pop.style.right = Math.max(12, window.innerWidth - fabRect.left + 8) + "px";
    pop.style.bottom = Math.max(12, window.innerHeight - fabRect.bottom) + "px";
    pop.style.left = "auto";
    pop.style.top = "auto";

    function onDoc(e) {
      if (pop.contains(e.target) || (btn && btn.contains(e.target))) return;
      orcaCloseTagFilterPopover(ctx);
    }
    ctx.__tagFilterClose = onDoc;
    setTimeout(function () {
      document.addEventListener("click", onDoc, true);
    }, 0);

    pop.addEventListener("click", function (e) {
      var item = e.target.closest("[data-df-act]");
      if (!item || !pop.contains(item)) return;
      e.preventDefault();
      e.stopPropagation();
      var act = item.getAttribute("data-df-act");
      var on = false;
      if (act === "clear-tag") {
        on = orcaSetTagFilter(ctx, "");
      } else if (act === "filter-tag") {
        on = orcaSetTagFilter(ctx, item.getAttribute("data-tag"));
      }
      orcaCloseTagFilterPopover(ctx);
      orcaRefreshFeed().then(function () {
        ctx.reApp();
        if (on && ctx.filters.tags && ctx.filters.tags[0]) {
          orcaShowMessage("已按标签过滤 #" + ctx.filters.tags[0]);
        } else {
          orcaShowMessage("已取消标签筛选");
        }
      });
    });
  }).catch(function () {
    orcaShowMessage("无法加载标签");
  });
}

function orcaEnhanceFeedDom(el, ctx) {
  if (!el) return;
  // FAB：同步日记流（虎鲸编辑后可手动刷新；自动同步仍保留）
  var stack = el.querySelector(".mom-fab-stack");
  if (stack && !stack.querySelector("[data-df-act=refresh-feed]")) {
    var syncBtn = document.createElement("button");
    syncBtn.type = "button";
    syncBtn.className = "mom-outline-fab orca-df-refresh-fab";
    syncBtn.setAttribute("data-df-act", "refresh-feed");
    syncBtn.title = "同步日记流";
    syncBtn.setAttribute("aria-label", "同步日记流");
    syncBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-2.6-6.2"/><path d="M21 3v6h-6"/></svg>';
    var first = stack.firstChild;
    if (first) stack.insertBefore(syncBtn, first);
    else stack.appendChild(syncBtn);
  }
  // 回收站 / 归档柜 / 搜索已并入「工具」；清掉旧版独立 FAB
  if (stack) {
    stack.querySelectorAll("[data-df-act=open-trash], [data-df-act=open-archive], [data-df-act=open-search]").forEach(function (n) {
      n.remove();
    });
  }
  if (typeof orcaEnhanceToolsUi === "function") orcaEnhanceToolsUi(el, ctx);
  orcaRefreshToolsFab(ctx, el);
  // FAB 标签筛选高亮
  var tagFab = el.querySelector(".mom-tag-fab, [data-action=open-tag-filter]");
  if (tagFab) {
    var on = !!(ctx.filters && ctx.filters.tags && ctx.filters.tags[0]);
    tagFab.classList.toggle("is-on", on);
    tagFab.title = on ? ("标签筛选 · #" + ctx.filters.tags[0]) : "标签筛选";
  }
  // 标签筛选条
  if (!el.querySelector(".orca-df-tagbar")) {
    OrcaBlocks.collectUserTags().then(function (tags) {
      if (!el.isConnected) return;
      var bar = document.createElement("div");
      bar.className = "orca-df-tagbar";
      var active = (ctx.filters.tags || [])[0] || "";
      var chips = tags.map(function (t) {
        var on = active === t ? " is-on" : "";
        return '<button type="button" class="orca-df-tagchip' + on + '" data-df-act="filter-tag" data-tag="' + orcaEsc(t) + '">#' + orcaEsc(t) + "</button>";
      }).join("");
      bar.innerHTML = '<span class="orca-df-tagbar-label">' + dfT("标签") + "</span>" + chips +
        (active ? '<button type="button" class="orca-df-tagchip" data-df-act="clear-tag">' + dfT("全部") + "</button>" : "");
      var list = el.querySelector(".mom-list") || el.querySelector("[data-list]");
      if (list && list.parentNode) list.parentNode.insertBefore(bar, list);
      if (typeof orcaEnhanceToolsUi === "function") orcaEnhanceToolsUi(el, ctx);
    }).catch(function () {});
  }
  // 卡片：精简底栏；「⋯」内联展开图标（置顶 / 标签 / 打开 / 删除）
  el.querySelectorAll(".north-luna-moments-item, .mom-item").forEach(function (card) {
    var id = card.getAttribute("data-id") || (card.querySelector("[data-id]") && card.querySelector("[data-id]").getAttribute("data-id"));
    var it = (ctx.data().items || []).find(function (x) { return String(x.id) === String(id); });
    if (!it) return;
    var bid = it.blockId || Number(it.id);
    var bar = card.querySelector(".north-luna-moments-action-bar, .mom-action-bar");
    if (bar) {
      // 去掉浮层旧菜单 & 主栏里误放的次级按钮
      var wrap0 = bar.closest(".north-luna-moments-item-actions, .mom-item-actions");
      if (wrap0) {
        wrap0.querySelectorAll(".orca-df-more-menu").forEach(function (n) { n.remove(); });
        wrap0.classList.add("orca-df-actions-wrap");
      }
      bar.querySelectorAll(':scope > [data-action="like"], :scope > [data-action="pin"], :scope > [data-action="del"], :scope > [data-action="tag"], :scope > [data-df-act="open-orca"]').forEach(function (n) {
        n.remove();
      });
      // 地点仍留在底栏（常用）
      if (!bar.querySelector(':scope > [data-action="location"]')) {
        var locBtn = document.createElement("button");
        locBtn.type = "button";
        locBtn.className = "north-luna-moments-action-btn orca-df-loc-btn";
        locBtn.setAttribute("data-mid", String(it.id));
        locBtn.setAttribute("data-id", String(it.id));
        locBtn.setAttribute("data-action", "location");
        locBtn.title = it.location ? (dfT("地点：") + it.location) : dfT("添加地点");
        locBtn.setAttribute("aria-label", locBtn.title);
        locBtn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5c-1.4 0-2.5-1.1-2.5-2.5S10.6 6.5 12 6.5s2.5 1.1 2.5 2.5S13.4 11.5 12 11.5z"></path></svg>';
        if (it.location) locBtn.classList.add("is-on");
        var moreBtn0 = bar.querySelector('[data-action="more"]');
        if (moreBtn0) bar.insertBefore(locBtn, moreBtn0);
        else {
          var timeBtn = bar.querySelector('[data-action="time"]');
          if (timeBtn && timeBtn.nextSibling) bar.insertBefore(locBtn, timeBtn.nextSibling);
          else if (timeBtn) bar.appendChild(locBtn);
          else bar.appendChild(locBtn);
        }
      }
      // 「⋯」按钮
      var moreBtn = bar.querySelector('[data-action="more"]');
      if (!moreBtn) {
        moreBtn = document.createElement("button");
        moreBtn.type = "button";
        moreBtn.className = "north-luna-moments-action-btn orca-df-more-btn";
        moreBtn.setAttribute("data-mid", String(it.id));
        moreBtn.setAttribute("data-id", String(it.id));
        moreBtn.setAttribute("data-action", "more");
        moreBtn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path></svg>';
        bar.appendChild(moreBtn);
      }
      moreBtn.title = dfT("更多");
      moreBtn.setAttribute("aria-label", dfT("更多"));
      moreBtn.setAttribute("aria-expanded", "false");
      // 内联展开的次级图标组（每次刷新同步置顶/标签态）
      var userTags = (it.tags || []).filter(function (t) { return t && t !== "日记流"; });
      var pinTitle = dfT(it.pinned ? "取消置顶" : "置顶");
      var tagTitle = userTags.length ? (dfT("标签：") + userTags.map(function (t) { return "#" + t; }).join(" ")) : dfT("标签");
      var extra = bar.querySelector(".orca-df-more-inline");
      if (!extra) {
        extra = document.createElement("span");
        extra.className = "orca-df-more-inline";
        extra.setAttribute("role", "group");
        extra.setAttribute("aria-label", "更多操作");
        bar.appendChild(extra);
      }
      extra.innerHTML =
        '<button type="button" class="north-luna-moments-action-btn' + (it.pinned ? " active is-on" : "") + '" data-action="pin" data-id="' + orcaEsc(it.id) + '" data-mid="' + orcaEsc(it.id) + '" title="' + orcaEsc(pinTitle) + '" aria-label="' + orcaEsc(pinTitle) + '"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v4l1 1 1-1v-4h5v-2l-2-2z"></path></svg></button>' +
        '<button type="button" class="north-luna-moments-action-btn orca-df-archive-btn" data-action="archive" data-id="' + orcaEsc(it.id) + '" data-mid="' + orcaEsc(it.id) + '" title="' + orcaEsc(dfT("归档")) + '" aria-label="' + orcaEsc(dfT("归档")) + '"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z"/></svg></button>' +
        '<button type="button" class="north-luna-moments-action-btn orca-df-tag-btn' + (userTags.length ? " is-on" : "") + '" data-action="tag" data-id="' + orcaEsc(it.id) + '" data-mid="' + orcaEsc(it.id) + '" title="' + orcaEsc(tagTitle) + '" aria-label="' + orcaEsc(tagTitle) + '"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M21.4 11.6l-9-9C12 2.2 11.5 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .5.2 1 .6 1.4l9 9c.4.4.9.6 1.4.6s1-.2 1.4-.6l7-7c.4-.4.6-.9.6-1.4 0-.5-.2-1-.6-1.4zM6.5 8C5.7 8 5 7.3 5 6.5S5.7 5 6.5 5 8 5.7 8 6.5 7.3 8 6.5 8z"></path></svg></button>' +
        '<button type="button" class="north-luna-moments-action-btn orca-df-share-btn" data-action="share" data-id="' + orcaEsc(it.id) + '" data-mid="' + orcaEsc(it.id) + '" title="' + orcaEsc(dfT("生成分享图")) + '" aria-label="' + orcaEsc(dfT("生成分享图")) + '"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81a3 3 0 1 0-3-3c0 .24.04.47.09.7L8.04 9.81A3 3 0 1 0 6 15a2.99 2.99 0 0 0 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65a2.92 2.92 0 1 0 2.92-2.92z"/></svg></button>' +
        '<button type="button" class="north-luna-moments-action-btn orca-df-meta-btn' + ((it.mood || it.weather) ? " is-on" : "") + '" data-action="meta" data-id="' + orcaEsc(it.id) + '" data-mid="' + orcaEsc(it.id) + '" title="' + orcaEsc(dfT("心情 / 天气")) + '" aria-label="' + orcaEsc(dfT("心情 / 天气")) + '"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm7 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM12 17.5c2.3 0 4.2-1.5 4.9-3.5H7.1c.7 2 2.6 3.5 4.9 3.5z"></path></svg></button>' +
        '<button type="button" class="north-luna-moments-action-btn north-luna-moments-action-del orca-df-more-del" data-action="del" data-id="' + orcaEsc(it.id) + '" data-mid="' + orcaEsc(it.id) + '" title="' + orcaEsc(dfT("删除")) + '" aria-label="' + orcaEsc(dfT("删除")) + '"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path></svg></button>';
      bar.classList.remove("is-more-open");
    }
    // meta 地点可点编辑；无地点时不额外插空行（靠动作栏添加）
    if (it.location) {
      var meta = card.querySelector(".north-luna-moments-meta, .mom-meta");
      if (meta) {
        var locEl = null;
        meta.querySelectorAll(".north-luna-moments-meta-item, .mom-meta-item").forEach(function (span) {
          if (span.getAttribute("data-action") === "location") locEl = span;
          else if (!locEl && String(span.textContent || "").trim() === String(it.location).trim()) locEl = span;
        });
        if (locEl) {
          locEl.setAttribute("data-action", "location");
          locEl.setAttribute("data-id", String(it.id));
          locEl.setAttribute("data-mid", String(it.id));
          locEl.classList.add("orca-df-loc-meta");
          locEl.title = "点击修改地点";
          if (!locEl.querySelector(".orca-df-loc-pin")) {
            locEl.insertAdjacentHTML("afterbegin", '<span class="orca-df-loc-pin" aria-hidden="true">📍</span> ');
          }
        }
      }
    }
    if (it.mood || it.weather) {
      var contentEl = card.querySelector(".north-luna-moments-item-content, .mom-item-content") || card;
      if (contentEl && !contentEl.querySelector(".orca-df-meta-chips")) {
        var chipRow = document.createElement("div");
        chipRow.className = "orca-df-meta-chips";
        chipRow.innerHTML =
          (it.mood ? '<span class="orca-df-meta-chip">' + orcaEsc(it.mood) + "</span>" : "") +
          (it.weather ? '<span class="orca-df-meta-chip">' + orcaEsc(it.weather) + "</span>" : "");
        contentEl.appendChild(chipRow);
      }
    }
    if (it.imagesMeta && it.imagesMeta.some(function (c) { return c && String(c).trim(); })) {
      var capContent = card.querySelector(".north-luna-moments-item-content, .mom-item-content") || card;
      if (capContent && !capContent.querySelector(".orca-df-captions")) {
        var capRow = document.createElement("div");
        capRow.className = "orca-df-captions";
        capRow.innerHTML = it.imagesMeta.map(function (c, i) {
          if (!c || !String(c).trim()) return "";
          return '<span class="orca-df-caption">' + (i + 1) + ". " + orcaEsc(String(c).trim()) + "</span>";
        }).join("");
        capContent.appendChild(capRow);
      }
    }
    if (card.querySelector(".orca-df-refs")) return;
    if (!it.refs || !it.refs.length) return;
    var row = document.createElement("div");
    row.className = "orca-df-refs";
    row.innerHTML = it.refs.map(function (r) {
      var label = r.alias || ("#" + r.id);
      return '<button type="button" class="orca-df-refchip" data-df-act="goto-ref" data-block-id="' + orcaEsc(r.id) + '">↗ ' + orcaEsc(label) + "</button>";
    }).join("");
    var content = card.querySelector(".north-luna-moments-item-content, .mom-item-content") || card;
    content.appendChild(row);
  });
  orcaEnhanceComments(el);
  orcaLocalizeVendorUi(el);
  orcaLazyHydrateDeepBodies(el, ctx);
  orcaEnsureLoadMoreButton(el, ctx);
}

function orcaLocalizeVendorUi(el) {
  if (!el || !dfLocaleIsEn()) return;
  function trAttr(sel, attr) {
    el.querySelectorAll(sel).forEach(function (n) {
      var v = n.getAttribute(attr);
      if (v && /[\u4e00-\u9fff]/.test(v)) n.setAttribute(attr, dfT(v));
    });
  }
  trAttr('[data-action="toggle-comments"]', "title");
  trAttr('[data-action="toggle-comments"]', "aria-label");
  trAttr('[data-action="open-outline"]', "title");
  trAttr('[data-action="open-editor"]', "title");
  trAttr('[data-action="edit"]', "title");
  trAttr('[data-action="play-vid"]', "title");
  trAttr('.north-luna-moments-comment-del[data-action="del-comment"]', "title");
  trAttr('.north-luna-moments-comment-del[data-action="del-comment"]', "aria-label");
  el.querySelectorAll(".north-luna-moments-comment-input").forEach(function (n) {
    var v = n.getAttribute("placeholder");
    if (v && /[\u4e00-\u9fff]/.test(v)) n.setAttribute("placeholder", dfT(v));
  });
  el.querySelectorAll(".north-luna-moments-comment-send").forEach(function (n) {
    if (n.textContent && /[\u4e00-\u9fff]/.test(n.textContent)) n.textContent = dfT(n.textContent.trim());
  });
  [".mom-empty-title", ".mom-empty-sub", ".mom-empty-hint", ".mom-empty-btn"].forEach(function (sel) {
    el.querySelectorAll(sel).forEach(function (n) {
      if (n.textContent && /[\u4e00-\u9fff]/.test(n.textContent)) n.textContent = dfT(n.textContent.trim());
    });
  });
}

/** 给每条评论注入「编辑」按钮（vendor 只提供删除） */
function orcaEnhanceComments(el) {
  if (!el) return;
  el.querySelectorAll(".north-luna-moments-comment-item").forEach(function (item) {
    var right = item.querySelector(".north-luna-moments-comment-actions-right");
    if (!right || right.querySelector('[data-action="edit-comment"]')) return;
    var panel = item.closest(".north-luna-moments-comment-panel");
    var mid = panel ? panel.getAttribute("data-mid") : "";
    var cid = item.getAttribute("data-cid");
    if (!mid || !cid) return;
    var edit = document.createElement("span");
    edit.className = "north-luna-moments-comment-del orca-df-comment-edit";
    edit.setAttribute("data-mid", mid);
    edit.setAttribute("data-id", mid);
    edit.setAttribute("data-cid", cid);
    edit.setAttribute("data-action", "edit-comment");
    edit.setAttribute("role", "button");
    edit.title = dfT("编辑");
    edit.setAttribute("aria-label", dfT("编辑"));
    edit.innerHTML = '<svg class="icon" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
    right.insertBefore(edit, right.firstChild);
  });
}

/** 深层嵌套条目：进视口后再拉全文，避免 listFeed 全树加载 */
function orcaLazyHydrateDeepBodies(el, ctx) {
  if (!el || typeof IntersectionObserver !== "function" || !OrcaBlocks) return;
  if (el.__dfLazyObs) {
    try { el.__dfLazyObs.disconnect(); } catch (e0) { /* ignore */ }
    el.__dfLazyObs = null;
  }
  var pending = (ctx.data().items || []).filter(function (it) { return it && it.needsFullText; });
  if (!pending.length) return;
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var card = en.target;
      var id = card.getAttribute("data-id") || "";
      var it = (ctx.data().items || []).find(function (x) { return String(x.id) === String(id); });
      if (!it || !it.needsFullText || it.__dfFullLoading) return;
      it.__dfFullLoading = true;
      obs.unobserve(card);
      OrcaBlocks.blockToFeedItem(it.blockId || it.id, null, { fullText: true, shallow: false })
        .then(function (full) {
          if (!full) return;
          it.text = OrcaBlocks.stripInlineTagText(full.text || "", full.tags || it.tags || []);
          if (full.images && full.images.length) it.images = full.images;
          it.needsFullText = false;
          if (ctx && typeof ctx.reApp === "function") ctx.reApp();
        })
        .catch(function (e) {
          console.warn("[orca-diaryflow] lazy full text", e);
        })
        .then(function () {
          it.__dfFullLoading = false;
        });
    });
  }, { root: null, rootMargin: "120px", threshold: 0.01 });
  el.querySelectorAll(".north-luna-moments-item, .mom-item").forEach(function (card) {
    var id = card.getAttribute("data-id");
    var it = (ctx.data().items || []).find(function (x) { return String(x.id) === String(id); });
    if (it && it.needsFullText) obs.observe(card);
  });
  el.__dfLazyObs = obs;
}

function orcaEnsureLoadMoreButton(el, ctx) {
  if (!el) return;
  var list =
    el.querySelector(".north-luna-moments-list, .mom-list, .orca-df-feed-list") ||
    el.querySelector("[class*='moments-list']");
  var host = list || el;
  var old = el.querySelector(".orca-df-load-more");
  if (old) old.remove();
  var data = (ctx && ctx.data && ctx.data()) || orcaMomentsData || {};
  if (!data._hasMore) return;
  var shown = (data.items || []).length;
  var total = data._allCount || shown;
  var wrap = document.createElement("div");
  wrap.className = "orca-df-load-more";
  var moreLabel = dfLocaleIsEn()
    ? ("Load more (" + shown + " / " + total + ")")
    : ("加载更多（" + shown + " / " + total + "）");
  wrap.innerHTML =
    '<button type="button" class="orca-df-load-more-btn" data-action="load-more-feed">' +
    moreLabel +
    "</button>";
  host.appendChild(wrap);
}

function orcaCollapseAllMoreBars(exceptBar) {
  document.querySelectorAll(".north-luna-moments-action-bar.is-more-open, .mom-action-bar.is-more-open").forEach(function (b) {
    if (exceptBar && b === exceptBar) return;
    b.classList.remove("is-more-open");
    var mb = b.querySelector('[data-action="more"]');
    if (mb) {
      mb.title = dfT("更多");
      mb.setAttribute("aria-label", dfT("更多"));
      mb.setAttribute("aria-expanded", "false");
    }
  });
}

function orcaPad2(n) {
  return String(n).padStart(2, "0");
}

function orcaToDatetimeLocalValue(ts) {
  var d = new Date(ts || Date.now());
  if (isNaN(d.getTime())) d = new Date();
  return d.getFullYear() + "-" + orcaPad2(d.getMonth() + 1) + "-" + orcaPad2(d.getDate()) +
    "T" + orcaPad2(d.getHours()) + ":" + orcaPad2(d.getMinutes());
}

/** 修改时间：写 overlay + 换日则移到对应虎鲸日记页 */
function orcaChangeEntryTime(ctx, it) {
  if (!it || !OrcaBlocks) return;
  var bid = it.blockId || Number(it.id);
  if (!bid || !isFinite(Number(bid))) {
    orcaShowMessage("找不到对应虎鲸块");
    return;
  }
  var overlay = document.createElement("div");
  overlay.className = "mom-overlay mom-time orca-df-time-overlay";
  overlay.innerHTML =
    '<div class="mom-modal mom-modal-sm">' +
      '<div class="mom-modal-head"><span>修改时间</span><button type="button" class="mom-modal-x" data-x>×</button></div>' +
      '<div class="mom-modal-body">' +
        '<input type="datetime-local" class="mom-inp" data-dt value="' + orcaEsc(orcaToDatetimeLocalValue(it.createdAt || Date.now())) + '">' +
        '<p class="orca-df-time-hint">会同步到日记流展示；若改了日期，条目会移到虎鲸对应日记页。</p>' +
      "</div>" +
      '<div class="mom-modal-foot">' +
        '<button type="button" class="mom-btn" data-x>取消</button>' +
        '<button type="button" class="mom-btn mom-btn-primary" data-save>确定</button>' +
      "</div>" +
    "</div>";
  dfMountDialog(overlay);
  function close() {
    try { overlay.remove(); } catch (e) { /* ignore */ }
  }
  function save() {
    var v = overlay.querySelector("[data-dt]") && overlay.querySelector("[data-dt]").value;
    if (!v) { close(); return; }
    var d = new Date(v);
    if (isNaN(d.getTime())) {
      orcaShowMessage("时间无效");
      return;
    }
    orcaMuteFeedSync(2500);
    OrcaBlocks.updateEntryTime(bid, d).then(function (res) {
      it.createdAt = d.getTime();
      it.created = d.getFullYear() + "-" + orcaPad2(d.getMonth() + 1) + "-" + orcaPad2(d.getDate()) +
        " " + orcaPad2(d.getHours()) + ":" + orcaPad2(d.getMinutes());
      return orcaRefreshFeed({ skipHeal: true, preferLive: true });
    }).then(function () {
      if (ctx && typeof ctx.reApp === "function") ctx.reApp();
      orcaShowMessage("时间已更新");
      close();
    }).catch(function (e) {
      console.error("[orca-diaryflow] update time", e);
      orca.notify("error", dfT("改时间失败: ") + (e && e.message || e), { title: dfT("日记流") });
    });
  }
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay || e.target.closest("[data-x]")) close();
    else if (e.target.closest("[data-save]")) save();
  });
}

/** 修改地点：双写 overlay + 块属性 df.location */
function orcaChangeEntryLocation(ctx, it) {
  if (!it || !OrcaBlocks) return;
  var bid = it.blockId || Number(it.id);
  if (!bid || !isFinite(Number(bid))) {
    orcaShowMessage("找不到对应虎鲸块");
    return;
  }
  var overlay = document.createElement("div");
  overlay.className = "mom-overlay mom-time orca-df-loc-overlay";
  overlay.innerHTML =
    '<div class="mom-modal mom-modal-sm">' +
      '<div class="mom-modal-head"><span>地点</span><button type="button" class="mom-modal-x" data-x>×</button></div>' +
      '<div class="mom-modal-body">' +
        '<input type="text" class="mom-inp" data-loc placeholder="例如：咖啡馆 / 公司" value="' + orcaEsc(it.location || "") + '" maxlength="80">' +
        '<p class="orca-df-time-hint">写入正文末行「地点：…」，并同步到虎鲸属性 df.location。</p>' +
      "</div>" +
      '<div class="mom-modal-foot">' +
        '<button type="button" class="mom-btn" data-x>取消</button>' +
        '<button type="button" class="mom-btn" data-clear>清除</button>' +
        '<button type="button" class="mom-btn mom-btn-primary" data-save>确定</button>' +
      "</div>" +
    "</div>";
  dfMountDialog(overlay);
  var inp = overlay.querySelector("[data-loc]");
  if (inp) {
    try { inp.focus(); inp.select(); } catch (eF) { /* ignore */ }
  }
  function close() {
    try { overlay.remove(); } catch (e) { /* ignore */ }
  }
  function apply(loc) {
    orcaMuteFeedSync(2500);
    OrcaBlocks.updateEntryLocation(bid, loc).then(function () {
      it.location = loc || "";
      return orcaRefreshFeed({ skipHeal: true, preferLive: true });
    }).then(function () {
      if (ctx && typeof ctx.reApp === "function") ctx.reApp();
      orcaShowMessage(loc ? "地点已更新" : "地点已清除");
      close();
    }).catch(function (e) {
      console.error("[orca-diaryflow] update location", e);
      orca.notify("error", dfT("改地点失败: ") + (e && e.message || e), { title: dfT("日记流") });
    });
  }
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay || e.target.closest("[data-x]")) close();
    else if (e.target.closest("[data-clear]")) apply("");
    else if (e.target.closest("[data-save]")) {
      var v = inp && inp.value != null ? String(inp.value).trim() : "";
      apply(v);
    }
  });
  overlay.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      var v = inp && inp.value != null ? String(inp.value).trim() : "";
      apply(v);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });
}

/** 修改用户标签：写入虎鲸 insertTag/removeTag（不含 #日记流） */
function orcaChangeEntryTags(ctx, it) {
  if (!it || !OrcaBlocks) return;
  var bid = it.blockId || Number(it.id);
  if (!bid || !isFinite(Number(bid))) {
    orcaShowMessage("找不到对应虎鲸块");
    return;
  }
  var selected = {};
  (it.tags || []).forEach(function (t) {
    t = String(t || "").replace(/^#/, "").trim();
    if (t && t !== "日记流") selected[t] = true;
  });

  var overlay = document.createElement("div");
  overlay.className = "mom-overlay mom-time orca-df-tags-overlay";
  overlay.innerHTML =
    '<div class="mom-modal mom-modal-sm orca-df-tags-modal">' +
      '<div class="mom-modal-head"><span>标签</span><button type="button" class="mom-modal-x" data-x>×</button></div>' +
      '<div class="mom-modal-body">' +
        '<div class="orca-df-tags-list" data-tag-list></div>' +
        '<div class="orca-df-tags-add">' +
          '<input type="text" class="mom-inp" data-new-tag placeholder="新建标签，回车添加" maxlength="40">' +
          '<button type="button" class="mom-btn" data-add-tag>添加</button>' +
        "</div>" +
        '<p class="orca-df-time-hint">写入虎鲸真实标签；可用 FAB / 顶栏筛选。#日记流 为入流标签，不可在此修改。</p>' +
      "</div>" +
      '<div class="mom-modal-foot">' +
        '<button type="button" class="mom-btn" data-x>取消</button>' +
        '<button type="button" class="mom-btn mom-btn-primary" data-save>确定</button>' +
      "</div>" +
    "</div>";
  dfMountDialog(overlay);
  var listEl = overlay.querySelector("[data-tag-list]");
  var newInp = overlay.querySelector("[data-new-tag]");

  function renderList(allTags) {
    if (!listEl) return;
    var names = (allTags || []).slice();
    Object.keys(selected).forEach(function (t) {
      if (names.indexOf(t) < 0) names.push(t);
    });
    names.sort();
    if (!names.length) {
      listEl.innerHTML = '<div class="orca-df-tags-empty">暂无标签，可在下方新建</div>';
      return;
    }
    listEl.innerHTML = names.map(function (t) {
      var on = selected[t] ? " is-on" : "";
      return '<button type="button" class="orca-df-tagpick' + on + '" data-toggle-tag="' + orcaEsc(t) + '">#' + orcaEsc(t) + "</button>";
    }).join("");
  }

  function addFromInput() {
    var t = newInp && newInp.value != null ? String(newInp.value).replace(/^#/, "").trim() : "";
    if (!t) return;
    if (t === "日记流") {
      orcaShowMessage("#日记流 为系统标签");
      return;
    }
    selected[t] = true;
    if (newInp) newInp.value = "";
    var cur = [];
    listEl.querySelectorAll("[data-toggle-tag]").forEach(function (btn) {
      cur.push(btn.getAttribute("data-toggle-tag"));
    });
    if (cur.indexOf(t) < 0) cur.push(t);
    renderList(cur);
  }

  OrcaBlocks.collectUserTags().then(function (tags) {
    if (!overlay.isConnected) return;
    renderList(tags);
  }).catch(function () {
    renderList(Object.keys(selected));
  });

  function close() {
    try { overlay.remove(); } catch (e) { /* ignore */ }
  }
  function save() {
    var want = Object.keys(selected).filter(function (t) { return selected[t]; });
    orcaMuteFeedSync(2500);
    OrcaBlocks.updateEntryTags(bid, want).then(function (res) {
      it.tags = (res && res.tags) || want;
      return orcaRefreshFeed({ skipHeal: true, preferLive: true });
    }).then(function () {
      if (ctx && typeof ctx.reApp === "function") ctx.reApp();
      orcaShowMessage("标签已更新");
      close();
    }).catch(function (e) {
      console.error("[orca-diaryflow] update tags", e);
      orca.notify("error", dfT("改标签失败: ") + (e && e.message || e), { title: dfT("日记流") });
    });
  }

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay || e.target.closest("[data-x]")) {
      close();
      return;
    }
    var pick = e.target.closest("[data-toggle-tag]");
    if (pick) {
      var name = pick.getAttribute("data-toggle-tag");
      if (selected[name]) delete selected[name];
      else selected[name] = true;
      pick.classList.toggle("is-on", !!selected[name]);
      return;
    }
    if (e.target.closest("[data-add-tag]")) {
      addFromInput();
      return;
    }
    if (e.target.closest("[data-save]")) save();
  });
  overlay.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Enter" && e.target && e.target.getAttribute("data-new-tag") != null) {
      e.preventDefault();
      addFromInput();
    }
  });
  if (newInp) {
    try { newInp.focus(); } catch (eF) { /* ignore */ }
  }
}

function orcaBindFeedActions(el, ctx) {
  if (!el || el.__dfBound) return;
  el.__dfBound = true;
  el.addEventListener("click", function (e) {
    // 点卡片正文 → 虎鲸编辑（时间线不扁改正文）
    var textHit = e.target.closest && e.target.closest(".north-luna-moments-item-text, .mom-item-text");
    if (textHit && el.contains(textHit) && !e.target.closest("a, button, [data-action], [data-df-act], [data-act], .north-luna-moments-comment-panel")) {
      var card0 = textHit.closest(".north-luna-moments-item, .mom-item");
      var tid0 = card0 && (card0.getAttribute("data-id") || card0.dataset.id);
      var tit0 = (ctx.data().items || []).find(function (x) { return String(x.id) === String(tid0); });
      if (tit0) {
        e.preventDefault();
        e.stopPropagation();
        var bid0 = tit0.blockId || Number(tit0.id);
        if (bid0 && isFinite(Number(bid0))) orcaOpenInOrca(bid0);
        return;
      }
    }

    var btn = e.target.closest("[data-df-act], [data-action], [data-act]");
    if (!btn || !el.contains(btn)) return;
    var dfAct = btn.getAttribute("data-df-act");
    if (dfAct) {
      e.preventDefault();
      e.stopPropagation();
      orcaHandleDfAct(ctx, dfAct, btn);
      return;
    }
    var action = btn.getAttribute("data-action") || btn.getAttribute("data-act");
    if (action === "open-editor") {
      e.preventDefault();
      e.stopPropagation();
      orcaOpenComposeDialog(ctx);
      return;
    }
    if (action === "open-tag-filter") {
      e.preventDefault();
      e.stopPropagation();
      orcaOpenTagFilter(ctx, btn);
      return;
    }
    if (action === "open-outline") {
      e.preventDefault();
      e.stopPropagation();
      orcaOpenMonthOutline(ctx);
      return;
    }
    if (action === "edit") {
      e.preventDefault();
      e.stopPropagation();
      var id = btn.dataset.id || btn.getAttribute("data-id") || btn.dataset.mid;
      var it = (ctx.data().items || []).find(function (x) { return String(x.id) === String(id); });
      if (!it) return;
      var bid = it.blockId || Number(it.id);
      if (bid && isFinite(Number(bid))) orcaOpenInOrca(bid);
      else orcaShowMessage("找不到对应虎鲸块");
      return;
    }
    if (action === "send-comment") {
      e.preventDefault();
      e.stopPropagation();
      orcaSendComment(ctx, btn);
      return;
    }
    if (action === "del-comment") {
      e.preventDefault();
      e.stopPropagation();
      orcaDeleteComment(ctx, btn);
      return;
    }
    if (action === "edit-comment") {
      e.preventDefault();
      e.stopPropagation();
      orcaEditComment(ctx, btn);
      return;
    }
    if (action === "load-more-feed") {
      e.preventDefault();
      e.stopPropagation();
      orcaLoadMoreFeed(ctx);
      return;
    }
    if (action === "more") {
      e.preventDefault();
      e.stopPropagation();
      var bar = btn.closest(".north-luna-moments-action-bar, .mom-action-bar");
      if (!bar) return;
      var willOpen = !bar.classList.contains("is-more-open");
      orcaCollapseAllMoreBars(willOpen ? bar : null);
      bar.classList.toggle("is-more-open", willOpen);
      btn.title = dfT(willOpen ? "收起" : "更多");
      btn.setAttribute("aria-label", dfT(willOpen ? "收起" : "更多"));
      btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
      return;
    }
    if (action === "time") {
      e.preventDefault();
      e.stopPropagation();
      var tid = btn.dataset.id || btn.getAttribute("data-id") || btn.dataset.mid;
      var tit = (ctx.data().items || []).find(function (x) { return String(x.id) === String(tid); });
      if (!tit) return;
      orcaChangeEntryTime(ctx, tit);
      return;
    }
    if (action === "location") {
      e.preventDefault();
      e.stopPropagation();
      var lid = btn.dataset.id || btn.getAttribute("data-id") || btn.dataset.mid;
      var lit = (ctx.data().items || []).find(function (x) { return String(x.id) === String(lid); });
      if (!lit) return;
      orcaChangeEntryLocation(ctx, lit);
      return;
    }
    if (action === "tag") {
      e.preventDefault();
      e.stopPropagation();
      orcaCollapseAllMoreBars();
      var tagId = btn.dataset.id || btn.getAttribute("data-id") || btn.dataset.mid;
      var tagIt = (ctx.data().items || []).find(function (x) { return String(x.id) === String(tagId); });
      if (!tagIt) return;
      orcaChangeEntryTags(ctx, tagIt);
      return;
    }
    if (action === "share") {
      e.preventDefault();
      e.stopPropagation();
      orcaCollapseAllMoreBars();
      var shareId = btn.dataset.id || btn.getAttribute("data-id") || btn.dataset.mid;
      var shareIt = (ctx.data().items || []).find(function (x) { return String(x.id) === String(shareId); });
      if (!shareIt) shareIt = (orcaFeedAllItems || []).find(function (x) { return String(x.id) === String(shareId); });
      if (!shareIt || typeof orcaToolsShareEntry !== "function") return;
      orcaToolsShareEntry(shareIt, (ctx.data().config) || {}).then(function (ok) {
        orcaShowMessage(ok ? "已生成分享图片" : "生成失败");
      });
      return;
    }
    if (action === "meta") {
      e.preventDefault();
      e.stopPropagation();
      orcaCollapseAllMoreBars();
      var metaId = btn.dataset.id || btn.getAttribute("data-id") || btn.dataset.mid;
      var metaIt = (ctx.data().items || []).find(function (x) { return String(x.id) === String(metaId); });
      if (!metaIt) return;
      orcaChangeEntryMeta(ctx, metaIt);
      return;
    }
    if (action === "pin" || action === "like") {
      e.preventDefault();
      e.stopPropagation();
      if (action === "like") return; // 已去掉点赞
      var mid = btn.dataset.id;
      var mit = (ctx.data().items || []).find(function (x) { return String(x.id) === String(mid); });
      if (!mit) return;
      orcaCollapseAllMoreBars();
      OrcaBlocks.setOverlay(mit.blockId || mit.id, { pinned: !mit.pinned }).then(function () {
        return orcaRefreshFeed({ keepLimit: true });
      }).then(function () { ctx.reApp(); });
      return;
    }
    if (action === "archive") {
      e.preventDefault();
      e.stopPropagation();
      orcaCollapseAllMoreBars();
      var aid = btn.dataset.id || btn.getAttribute("data-id") || btn.dataset.mid;
      var ait = (ctx.data().items || []).find(function (x) { return String(x.id) === String(aid); });
      if (!ait) return;
      var archMsg = dfT("归档这条日记？\n主时间线将隐藏，可在归档柜取消归档。\n") + String(ait.text || "").slice(0, 40);
      if (dfGetSetting("confirmDelete") && !window.confirm(archMsg)) return;
      OrcaBlocks.setEntryArchived(ait.blockId || ait.id, true).then(function () {
        return orcaRefreshFeed({ keepLimit: true });
      }).then(function () {
        ctx.reApp();
        orcaShowMessage("已归档");
        orcaRefreshArchiveFab(ctx);
      }).catch(function (err) {
        orcaShowMessage(String(err && err.message || "归档失败"));
      });
      return;
    }
    if (action === "del") {
      e.preventDefault();
      e.stopPropagation();
      orcaCollapseAllMoreBars();
      var delId = btn.dataset.id;
      var delIt = (ctx.data().items || []).find(function (x) { return String(x.id) === String(delId); });
      if (!delIt) return;
      var delMsg = dfT("将这条日记移入回收站？\n（可在回收站恢复，约保留 30 天）\n") + String(delIt.text || "").slice(0, 40);
      if (dfGetSetting("confirmDelete") && !window.confirm(delMsg)) return;
      OrcaBlocks.deleteEntry(delIt.blockId || delIt.id).then(function () {
        return orcaRefreshFeed({ keepLimit: true });
      }).then(function () {
        ctx.reApp();
        orcaShowMessage("已移入回收站");
        orcaRefreshTrashFab(ctx);
      }).catch(function (e) {
        console.warn("[orca-diaryflow] delete", e);
        orcaShowMessage(String(e && e.message || "删除失败"));
      });
      return;
    }
    if (action === "search-tag") {
      e.preventDefault();
      e.stopPropagation();
      var tag = btn.getAttribute("data-tag");
      if (!tag) return;
      var on = orcaSetTagFilter(ctx, tag);
      orcaRefreshFeed().then(function () {
        ctx.reApp();
        orcaShowMessage(on ? ("已按标签过滤 #" + tag) : "已取消标签筛选");
      });
    }
  }, true);
  if (!el.__dfMoreClose) {
    el.__dfMoreClose = function (ev) {
      if (ev.target && ev.target.closest && ev.target.closest(".orca-df-more-inline, [data-action=more]")) return;
      orcaCollapseAllMoreBars();
    };
    document.addEventListener("click", el.__dfMoreClose, true);
  }
}

function orcaSendComment(ctx, btn) {
  if (!OrcaBlocks || !btn) return;
  var id = btn.dataset.id || btn.getAttribute("data-id") || btn.dataset.mid;
  var it = (ctx.data().items || []).find(function (x) { return String(x.id) === String(id); });
  if (!it) {
    it = (orcaFeedAllItems || []).find(function (x) { return String(x.id) === String(id); });
  }
  if (!it) return;
  var panel = btn.closest(".north-luna-moments-comment-panel");
  var input = panel && panel.querySelector(".north-luna-moments-comment-input");
  var text = ((input && input.value) || "").trim();
  if (!text) return;
  var nickname = ((ctx.data().config) || {}).nickname || dfT("我");
  var now = new Date();
  function p2(n) { return String(n).padStart(2, "0"); }
  var time = now.getFullYear() + "-" + p2(now.getMonth() + 1) + "-" + p2(now.getDate()) +
    " " + p2(now.getHours()) + ":" + p2(now.getMinutes()) + ":" + p2(now.getSeconds());
  btn.disabled = true;
  OrcaBlocks.addComment(it.blockId || it.id, { name: nickname, text: text, time: time })
    .then(function () {
      if (input) input.value = "";
      var row = panel && panel.querySelector(".north-luna-moments-comment-input-row");
      if (row) row.style.display = "none";
      return orcaRefreshFeed({ keepLimit: true });
    })
    .then(function () {
      if (ctx && typeof ctx.reApp === "function") ctx.reApp();
      orcaShowMessage("评论已写入日记");
    })
    .catch(function (e) {
      console.warn("[orca-diaryflow] send comment", e);
      orcaShowMessage("评论失败");
    })
    .then(function () { btn.disabled = false; });
}

function orcaDeleteComment(ctx, btn) {
  if (!OrcaBlocks || !btn) return;
  var id = btn.dataset.id || btn.getAttribute("data-id") || btn.dataset.mid;
  var cid = btn.dataset.cid || btn.getAttribute("data-cid");
  var it = (ctx.data().items || []).find(function (x) { return String(x.id) === String(id); });
  if (!it) {
    it = (orcaFeedAllItems || []).find(function (x) { return String(x.id) === String(id); });
  }
  if (!it || !cid) return;
  if (dfGetSetting("confirmDelete") && !window.confirm(dfT("删除这条评论？"))) return;
  OrcaBlocks.deleteComment(it.blockId || it.id, cid)
    .then(function () { return orcaRefreshFeed({ keepLimit: true }); })
    .then(function () {
      if (ctx && typeof ctx.reApp === "function") ctx.reApp();
      orcaShowMessage("已删除评论");
    })
    .catch(function (e) {
      console.warn("[orca-diaryflow] del comment", e);
      orcaShowMessage("删除评论失败");
    });
}

function orcaEditComment(ctx, btn) {
  if (!OrcaBlocks || !btn) return;
  var id = btn.dataset.id || btn.getAttribute("data-id") || btn.dataset.mid;
  var cid = btn.dataset.cid || btn.getAttribute("data-cid");
  var it = (ctx.data().items || []).find(function (x) { return String(x.id) === String(id); });
  if (!it) it = (orcaFeedAllItems || []).find(function (x) { return String(x.id) === String(id); });
  if (!it || !cid) return;
  var cur = "";
  (it.comments || []).forEach(function (c) {
    if (String(c && c.id) === String(cid)) cur = String(c.text || "");
  });
  var overlay = document.createElement("div");
  overlay.className = "mom-overlay mom-time orca-df-comment-overlay";
  overlay.innerHTML =
    '<div class="mom-modal mom-modal-sm">' +
      '<div class="mom-modal-head"><span>' + dfT("编辑评论") + '</span><button type="button" class="mom-modal-x" data-x>×</button></div>' +
      '<div class="mom-modal-body">' +
        '<input type="text" class="mom-inp" data-cmt maxlength="200" value="' + orcaEsc(cur) + '" placeholder="' + orcaEsc(dfT("写评论…")) + '">' +
      "</div>" +
      '<div class="mom-modal-foot">' +
        '<button type="button" class="mom-btn" data-x>' + dfT("取消") + "</button>" +
        '<button type="button" class="mom-btn mom-btn-primary" data-save>' + dfT("确定") + "</button>" +
      "</div>" +
    "</div>";
  dfMountDialog(overlay);
  var inp = overlay.querySelector("[data-cmt]");
  if (inp) { try { inp.focus(); inp.select(); } catch (eF) { /* ignore */ } }
  function close() {
    try { overlay.remove(); } catch (e) { /* ignore */ }
  }
  function save() {
    var v = inp && inp.value != null ? String(inp.value).trim() : "";
    if (!v) { orcaShowMessage("评论不能为空"); return; }
    orcaMuteFeedSync(2500);
    OrcaBlocks.updateComment(it.blockId || it.id, cid, v).then(function () {
      return orcaRefreshFeed({ keepLimit: true, skipHeal: true, preferLive: true });
    }).then(function () {
      if (ctx && typeof ctx.reApp === "function") ctx.reApp();
      orcaShowMessage("评论已更新");
      close();
    }).catch(function (e) {
      console.warn("[orca-diaryflow] update comment", e);
      orcaShowMessage("评论更新失败");
    });
  }
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay || e.target.closest("[data-x]")) close();
    else if (e.target.closest("[data-save]")) save();
  });
  overlay.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); save(); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  });
}

function orcaRefreshToolsFab(ctx, root) {
  var scope = root || (ctx && ctx.container) || document;
  var pTrash = (OrcaBlocks && typeof OrcaBlocks.trashCount === "function")
    ? OrcaBlocks.trashCount()
    : Promise.resolve(0);
  var pArch = (OrcaBlocks && typeof OrcaBlocks.listArchivedFeed === "function")
    ? OrcaBlocks.listArchivedFeed({ skipHeal: true }).then(function (feed) {
      return (feed && feed.items && feed.items.length) || 0;
    })
    : Promise.resolve(0);
  Promise.all([pTrash, pArch]).then(function (arr) {
    var n = (Number(arr[0]) || 0) + (Number(arr[1]) || 0);
    var nodes = (scope.querySelectorAll
      ? scope.querySelectorAll(".orca-df-tools-fab")
      : []);
    if (!nodes.length && typeof document !== "undefined") {
      nodes = document.querySelectorAll(".orca-df-scope .orca-df-tools-fab");
    }
    Array.prototype.forEach.call(nodes, function (btn) {
      var badge = btn.querySelector(".orca-df-tools-fab-count");
      if (!badge) return;
      if (n > 0) {
        badge.hidden = false;
        badge.textContent = n > 99 ? "99+" : String(n);
      } else {
        badge.hidden = true;
        badge.textContent = "0";
      }
    });
  }).catch(function () { /* ignore */ });
}

function orcaRefreshTrashFab(ctx, root) {
  orcaRefreshToolsFab(ctx, root);
}

function orcaRefreshArchiveFab(ctx, root) {
  orcaRefreshToolsFab(ctx, root);
}

function orcaTrashFormatTime(ts) {
  try {
    var d = new Date(ts);
    function p(n) { return String(n).padStart(2, "0"); }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  } catch (e) {
    return "";
  }
}

function orcaTrashRemainingText(ms) {
  var days = ms / 864e5;
  if (dfLocaleIsEn()) {
    if (days <= 0) return "Expires today";
    if (days < 1) return "Less than 1 day left";
    return Math.ceil(days) + " days left";
  }
  if (days <= 0) return "今天过期";
  if (days < 1) return "剩不到 1 天";
  return "剩 " + Math.ceil(days) + " 天";
}

function orcaCloseTrashDialog() {
  var old = document.querySelector(".orca-df-trash-backdrop");
  if (old) old.remove();
}

function orcaOpenTrashDialog(ctx) {
  if (!OrcaBlocks || typeof OrcaBlocks.trashList !== "function") {
    orcaShowMessage("回收站不可用");
    return;
  }
  orcaCloseTrashDialog();
  var host = document.createElement("div");
  host.className = "orca-df-trash-backdrop orca-df-scope";
  host.innerHTML =
    '<div class="orca-df-trash-pop" role="dialog" aria-label="日记流回收站">' +
    '<div class="orca-df-trash-head">' +
    "<span>回收站</span>" +
    '<div class="orca-df-trash-head-tools">' +
    '<input type="search" class="orca-df-list-search" data-df-trash-search placeholder="' + orcaEsc(dfT("搜索标题…")) + '" />' +
    '<select class="orca-df-list-sort" data-df-trash-sort>' +
    '<option value="deleted-desc">' + orcaEsc(dfT("删除时间（新→旧）")) + "</option>" +
    '<option value="deleted-asc">' + orcaEsc(dfT("删除时间（旧→新）")) + "</option>" +
    '<option value="title">' + orcaEsc(dfT("标题")) + "</option>" +
    "</select>" +
    '<span class="orca-df-trash-hint">保留约 30 天</span>' +
    '<button type="button" class="orca-df-trash-close" data-df-trash="close" aria-label="关闭">×</button>' +
    "</div></div>" +
    '<div class="orca-df-trash-body"><div class="orca-df-trash-empty">加载中…</div></div>' +
    '<div class="orca-df-trash-foot">' +
    '<button type="button" class="orca-df-trash-act" data-df-trash="restore-all">全部恢复</button>' +
    '<button type="button" class="orca-df-trash-act danger" data-df-trash="purge-all">清空回收站</button>' +
    "</div></div>";
  dfMountDialog(host);

  var body = host.querySelector(".orca-df-trash-body");
  var busy = false;
  var trashItems = [];
  var trashShown = DF_LIST_PAGE;
  var trashSearchEl = host.querySelector("[data-df-trash-search]");
  var trashSortEl = host.querySelector("[data-df-trash-sort]");
  var trashHintEl = host.querySelector(".orca-df-trash-hint");
  if (trashHintEl) {
    trashHintEl.textContent = dfLocaleIsEn()
      ? ("Kept about " + dfTrashRetentionDays() + " days")
      : ("保留约 " + dfTrashRetentionDays() + " 天");
  }

  function renderRows(items) {
    if (!items.length) {
      body.innerHTML = '<div class="orca-df-trash-empty">' + dfT("回收站为空") + "</div>";
      return;
    }
    body.innerHTML = items.map(function (it) {
      return (
        '<div class="orca-df-trash-row" data-trash-id="' + orcaEsc(it.trashId) + '">' +
        '<div class="orca-df-trash-meta">' +
        '<div class="orca-df-trash-title" title="' + orcaEsc(it.title || "") + '">' + orcaEsc(it.title || dfT("(无标题)")) + "</div>" +
        '<div class="orca-df-trash-sub">' + orcaEsc(orcaTrashFormatTime(it.deletedAt)) +
        " · " + orcaEsc(orcaTrashRemainingText(it.remainingMs)) + "</div>" +
        "</div>" +
        '<div class="orca-df-trash-actions">' +
        '<button type="button" class="orca-df-trash-act" data-df-trash="restore" data-id="' + orcaEsc(it.trashId) + '">' + dfT("恢复") + "</button>" +
        '<button type="button" class="orca-df-trash-act danger" data-df-trash="purge" data-id="' + orcaEsc(it.trashId) + '">' + dfT("彻底删除") + "</button>" +
        "</div></div>"
      );
    }).join("");
  }

  function applyTrashFilter() {
    var q = trashSearchEl && trashSearchEl.value ? String(trashSearchEl.value).trim().toLowerCase() : "";
    var list = q
      ? trashItems.filter(function (it) { return String(it && it.title || "").toLowerCase().indexOf(q) >= 0; })
      : trashItems;
    if (q && !list.length) {
      body.innerHTML = '<div class="orca-df-trash-empty">' + dfT("没有匹配的条目") + "</div>";
      return;
    }
    var tmode = trashSortEl ? String(trashSortEl.value || "deleted-desc") : "deleted-desc";
    list = list.slice();
    if (tmode === "deleted-asc") {
      list.sort(function (a, b) { return (a.deletedAt || 0) - (b.deletedAt || 0); });
    } else if (tmode === "title") {
      list.sort(function (a, b) { return String(a.title || "").localeCompare(String(b.title || "")); });
    } else {
      list.sort(function (a, b) { return (b.deletedAt || 0) - (a.deletedAt || 0); });
    }
    var shown = list.slice(0, trashShown);
    renderRows(shown);
    if (list.length > shown.length) {
      var mt = dfLocaleIsEn()
        ? ("Load more (" + shown.length + " / " + list.length + ")")
        : ("加载更多（" + shown.length + " / " + list.length + "）");
      body.insertAdjacentHTML("beforeend",
        '<div class="orca-df-list-more"><button type="button" class="orca-df-tools-btn" data-df-trash="more">' + mt + "</button></div>");
    }
  }

  function refresh() {
    return OrcaBlocks.trashList().then(function (items) {
      trashItems = items || [];
      applyTrashFilter();
      orcaRefreshTrashFab(ctx);
    }).catch(function () {
      body.innerHTML = '<div class="orca-df-trash-empty">' + dfT("加载失败") + "</div>";
    });
  }

  if (trashSearchEl) {
    trashSearchEl.addEventListener("input", function () {
      trashShown = DF_LIST_PAGE;
      applyTrashFilter();
    });
  }
  if (trashSortEl) {
    trashSortEl.addEventListener("change", function () {
      trashShown = DF_LIST_PAGE;
      applyTrashFilter();
    });
  }
  host.addEventListener("mousedown", function (e) {
    if (e.target === host) orcaCloseTrashDialog();
  });
  host.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-df-trash]");
    if (!btn || !host.contains(btn)) return;
    var act = btn.getAttribute("data-df-trash");
    if (act === "close") {
      orcaCloseTrashDialog();
      return;
    }
    if (act === "more") {
      trashShown += DF_LIST_PAGE;
      applyTrashFilter();
      return;
    }
    if (busy) return;
    if (act === "restore-all") {
      if (!trashItems.length) return;
      if (dfGetSetting("confirmDelete") && !window.confirm(dfT("全部恢复？共 ") + trashItems.length + dfT(" 条"))) return;
      busy = true;
      btn.disabled = true;
      var rids = trashItems.map(function (it) { return it.trashId; });
      var rdone = 0;
      Promise.resolve().then(function loop(i) {
        if (i >= rids.length) return null;
        return OrcaBlocks.restoreTrashItem(rids[i]).then(function () {
          rdone++;
          btn.textContent = dfT("全部恢复") + " " + rdone + "/" + rids.length;
          return loop(i + 1);
        });
      }).then(function () {
        orcaShowMessage("已恢复");
        return orcaRefreshFeed({ keepLimit: true });
      }).then(function () {
        if (ctx && typeof ctx.reApp === "function") ctx.reApp();
        return refresh();
      }).catch(function (err) {
        orcaShowMessage(String(err && err.message || "恢复失败"));
      }).then(function () {
        busy = false;
        btn.disabled = false;
        btn.textContent = dfT("全部恢复");
      });
      return;
    }
    if (act === "restore") {
      busy = true;
      OrcaBlocks.restoreTrashItem(btn.getAttribute("data-id"))
        .then(function (r) {
          var rt = (r && r.title) || "";
          if (r && r.wasArchived) orcaShowMessage("已恢复（原归档条目已回到时间线）：" + rt);
          else orcaShowMessage("已恢复：" + rt);
          return orcaRefreshFeed({ keepLimit: true });
        })
        .then(function () {
          if (ctx && typeof ctx.reApp === "function") ctx.reApp();
          return refresh();
        })
        .catch(function (err) {
          orcaShowMessage(String(err && err.message || "恢复失败"));
        })
        .then(function () { busy = false; });
      return;
    }
    if (act === "purge") {
      if (dfGetSetting("confirmDelete") && !window.confirm(dfT("彻底删除该条目？不可恢复。"))) return;
      busy = true;
      OrcaBlocks.purgeTrashItem(btn.getAttribute("data-id"))
        .then(function () { return refresh(); })
        .catch(function (err) { orcaShowMessage(String(err && err.message || "删除失败")); })
        .then(function () { busy = false; });
      return;
    }
    if (act === "purge-all") {
      var rows = host.querySelectorAll(".orca-df-trash-row").length;
      if (!rows) return;
      if (dfGetSetting("confirmDelete") && !window.confirm(dfT("确定清空回收站？共 ") + rows + dfT("项将永久删除，不可恢复。"))) return;
      busy = true;
      OrcaBlocks.purgeAllTrash()
        .then(function () {
          orcaShowMessage("回收站已清空");
          return refresh();
        })
        .catch(function (err) { orcaShowMessage(String(err && err.message || "清空失败")); })
        .then(function () { busy = false; });
    }
  });

  function onKey(e) {
    if (e.key === "Escape") {
      orcaCloseTrashDialog();
      document.removeEventListener("keydown", onKey, true);
    }
  }
  document.addEventListener("keydown", onKey, true);
  refresh();
}

function orcaItemTs(it) {
  if (!it) return Date.now();
  if (it.createdAt) return Number(it.createdAt) || Date.now();
  if (it.created) {
    var d = new Date(String(it.created).replace(" ", "T").replace(/-/g, "/"));
    if (!isNaN(d.getTime())) return d.getTime();
  }
  return Date.now();
}

function orcaItemMonthKey(it) {
  var d = new Date(orcaItemTs(it));
  if (isNaN(d.getTime())) return "unknown";
  var m = d.getMonth() + 1;
  return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m;
}

function orcaMonthLabel(monthKey) {
  var parts = String(monthKey || "").split("-");
  var y = Number(parts[0]);
  var m = Number(parts[1]);
  if (!y || !m) return String(monthKey || "");
  var now = new Date();
  var isCurrent = y === now.getFullYear() && m === now.getMonth() + 1;
  if (dfLocaleIsEn()) {
    return isCurrent ? "This month" : (DF_I18N_MONTHS[m - 1] + " " + y);
  }
  if (isCurrent) return "本月";
  return y + "年" + m + "月";
}

/** 从当前可见 feed（含未翻页）按月聚合，对齐安卓 OutlineScreen */
function orcaBuildMonthGroups(items) {
  var map = {};
  (items || []).forEach(function (it) {
    if (!it) return;
    var key = orcaItemMonthKey(it);
    if (!map[key]) map[key] = [];
    map[key].push(it);
  });
  return Object.keys(map).sort(function (a, b) { return a < b ? 1 : -1; }).map(function (key) {
    return {
      key: key,
      label: orcaMonthLabel(key),
      count: map[key].length
    };
  });
}

function orcaCloseMonthOutline() {
  var old = document.querySelector(".orca-df-outline-backdrop");
  if (old) old.remove();
}

function orcaJumpToMonth(ctx, monthKey) {
  var all = orcaFeedAllItems || [];
  var needIdx = -1;
  for (var i = 0; i < all.length; i++) {
    if (orcaItemMonthKey(all[i]) === monthKey) {
      needIdx = i;
      break;
    }
  }
  if (needIdx < 0) {
    orcaShowMessage("该月暂无日记");
    return;
  }
  var needLimit = needIdx + dfFeedPageSize();
  if ((orcaFeedLimit || 0) < needLimit) {
    orcaFeedLimit = needLimit;
    orcaApplyFeedWindow(orcaMomentsData && orcaMomentsData.config);
    if (ctx && typeof ctx.reApp === "function") ctx.reApp();
  }
  setTimeout(function () {
    var root = (ctx && ctx.container) || document;
    var target =
      (root.querySelector && root.querySelector('.north-luna-moments-item[data-date^="' + monthKey + '"]')) ||
      document.querySelector('.orca-df-scope .north-luna-moments-item[data-date^="' + monthKey + '"]');
    if (!target) {
      orcaShowMessage("该月暂无日记");
      return;
    }
    // 优先滚到该月分组标题
    var group = target.previousElementSibling;
    while (group && !(group.classList && group.classList.contains("north-luna-moments-date-group"))) {
      group = group.previousElementSibling;
    }
    var scrollTarget = group || target;
    try {
      scrollTarget.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (eScr) {
      var sc = (ctx && ctx.scrollEl) || (root.querySelector && root.querySelector(".mom-scroll"));
      if (sc) sc.scrollTop = Math.max(0, scrollTarget.offsetTop - 48);
    }
    target.classList.add("mom-flash");
    setTimeout(function () { target.classList.remove("mom-flash"); }, 1600);
  }, 80);
}

/** 点日历某天：扩充窗口后滚到该条目；无条目则打开当天日记 */
function orcaJumpToDate(ctx, dateStr) {
  if (!dateStr) return;
  var all = orcaFeedAllItems || [];
  var idx = -1;
  for (var i = 0; i < all.length; i++) {
    if (typeof orcaToolsItemDay === "function" && orcaToolsItemDay(all[i]) === dateStr) { idx = i; break; }
  }
  if (idx >= 0) {
    var need = idx + dfFeedPageSize();
    if ((orcaFeedLimit || 0) < need) {
      orcaFeedLimit = need;
      orcaApplyFeedWindow(orcaMomentsData && orcaMomentsData.config);
      if (ctx && typeof ctx.reApp === "function") ctx.reApp();
    }
    setTimeout(function () {
      var root = (ctx && ctx.container) || document;
      var target = (root.querySelector && root.querySelector('.north-luna-moments-item[data-date="' + dateStr + '"]')) ||
        document.querySelector('.orca-df-scope .north-luna-moments-item[data-date="' + dateStr + '"]');
      if (target) {
        try { target.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) { /* ignore */ }
        target.classList.add("mom-flash");
        setTimeout(function () { target.classList.remove("mom-flash"); }, 1600);
      }
    }, 80);
    return;
  }
  var d = new Date(dateStr + "T00:00:00");
  if (!isNaN(d.getTime())) {
    try { orca.nav.openInLastPanel("journal", { date: d }); } catch (e2) { /* ignore */ }
    orcaShowMessage("该日期暂无动态，已打开当天日记");
  }
}

var orcaCalendarJumpBound = false;
function orcaBindCalendarJump() {
  if (orcaCalendarJumpBound) return;
  orcaCalendarJumpBound = true;
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented) return;
    var cell = e.target && e.target.closest && e.target.closest(".mom-calendar-modal [data-date]");
    if (!cell) return;
    var ds = cell.getAttribute("data-date");
    if (!ds) return;
    e.preventDefault();
    e.stopPropagation();
    var modal = cell.closest(".mom-calendar-modal");
    var back = modal && modal.closest(".mom-overlay");
    if (back) { try { back.remove(); } catch (e2) { /* ignore */ } }
    orcaJumpToDate(orcaCtx, ds);
  }, true);
}

function orcaOpenMonthOutline(ctx) {
  orcaCloseMonthOutline();
  var groups = orcaBuildMonthGroups(orcaFeedAllItems || []);
  if (!groups.length) {
    orcaShowMessage("暂无月份分组");
    return;
  }
  var years = [];
  groups.forEach(function (g) {
    var y = String(g.key).slice(0, 4);
    if (y && years.indexOf(y) < 0) years.push(y);
  });
  var selectedYear = years[0] || "";

  var host = document.createElement("div");
  host.className = "orca-df-outline-backdrop orca-df-scope";
  host.innerHTML =
    '<div class="orca-df-outline-pop" role="dialog" aria-label="月份大纲">' +
    '<div class="orca-df-outline-head">' +
    '<button type="button" class="orca-df-outline-back" data-df-outline="close" aria-label="返回">' +
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>' +
    "</button>" +
    "<span>月份大纲</span>" +
    '<span class="orca-df-outline-head-spacer"></span>' +
    "</div>" +
    '<div class="orca-df-outline-years"></div>' +
    '<div class="orca-df-outline-hint">点年份快速定位</div>' +
    '<div class="orca-df-outline-months"></div>' +
    "</div>";
  dfMountDialog(host);

  var yearsEl = host.querySelector(".orca-df-outline-years");
  var monthsEl = host.querySelector(".orca-df-outline-months");
  var calIco =
    '<svg class="orca-df-outline-cal" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
    '<path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/>' +
    "</svg>";

  function renderYears() {
    var rows = [];
    for (var i = 0; i < years.length; i += 5) {
      rows.push(years.slice(i, i + 5));
    }
    yearsEl.innerHTML = rows.map(function (row) {
      var cells = row.map(function (y) {
        var on = y === selectedYear ? " is-on" : "";
        return (
          '<button type="button" class="orca-df-outline-year' + on + '" data-df-outline="year" data-year="' +
          orcaEsc(y) + '">' + orcaEsc(y) + "</button>"
        );
      }).join("");
      for (var p = row.length; p < 5; p++) {
        cells += '<span class="orca-df-outline-year-ph" aria-hidden="true"></span>';
      }
      return '<div class="orca-df-outline-year-row">' + cells + "</div>";
    }).join("");
  }

  function renderMonths() {
    var list = selectedYear
      ? groups.filter(function (g) { return String(g.key).indexOf(selectedYear) === 0; })
      : groups;
    if (!list.length) {
      monthsEl.innerHTML = '<div class="orca-df-outline-empty">' + dfT("这一年没有日记。") + "</div>";
      return;
    }
    monthsEl.innerHTML = list.map(function (g) {
      var cnt = g.count > 99 ? "99+" : String(g.count);
      return (
        '<button type="button" class="orca-df-outline-month" data-df-outline="month" data-month="' +
        orcaEsc(g.key) + '" title="' + orcaEsc(g.label) + '">' +
        calIco +
        '<span class="orca-df-outline-month-label">' + orcaEsc(g.label) + "</span>" +
        '<span class="orca-df-outline-month-count">' + orcaEsc(cnt) + "</span>" +
        "</button>"
      );
    }).join("");
  }

  renderYears();
  renderMonths();

  host.addEventListener("mousedown", function (e) {
    if (e.target === host) orcaCloseMonthOutline();
  });
  host.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-df-outline]");
    if (!btn || !host.contains(btn)) return;
    var act = btn.getAttribute("data-df-outline");
    if (act === "close") {
      orcaCloseMonthOutline();
      return;
    }
    if (act === "year") {
      selectedYear = btn.getAttribute("data-year") || "";
      renderYears();
      renderMonths();
      return;
    }
    if (act === "month") {
      var mk = btn.getAttribute("data-month");
      orcaCloseMonthOutline();
      if (mk) orcaJumpToMonth(ctx, mk);
    }
  });

  function onKey(e) {
    if (e.key === "Escape") {
      orcaCloseMonthOutline();
      document.removeEventListener("keydown", onKey, true);
    }
  }
  document.addEventListener("keydown", onKey, true);
}

function orcaCloseArchiveDialog() {
  var old = document.querySelector(".orca-df-archive-backdrop");
  if (old) old.remove();
}

function orcaOpenArchiveDialog(ctx) {
  if (!OrcaBlocks || typeof OrcaBlocks.listArchivedFeed !== "function") {
    orcaShowMessage("归档柜不可用");
    return;
  }
  orcaCloseArchiveDialog();
  var host = document.createElement("div");
  host.className = "orca-df-archive-backdrop orca-df-scope";
  host.innerHTML =
    '<div class="orca-df-archive-pop" role="dialog" aria-label="日记流归档柜">' +
    '<div class="orca-df-archive-head">' +
    "<span>归档柜</span>" +
    '<div class="orca-df-archive-head-tools">' +
    '<input type="search" class="orca-df-list-search" data-df-arch-search placeholder="' + orcaEsc(dfT("搜索标题…")) + '" />' +
    '<select class="orca-df-list-sort" data-df-arch-sort>' +
    '<option value="time-desc">' + orcaEsc(dfT("时间（新→旧）")) + "</option>" +
    '<option value="time-asc">' + orcaEsc(dfT("时间（旧→新）")) + "</option>" +
    '<option value="title">' + orcaEsc(dfT("标题")) + "</option>" +
    "</select>" +
    '<span class="orca-df-archive-hint">仍保留在日记页</span>' +
    '<button type="button" class="orca-df-archive-close" data-df-arch="close" aria-label="关闭">×</button>' +
    "</div></div>" +
    '<div class="orca-df-archive-body"><div class="orca-df-archive-empty">加载中…</div></div>' +
    '<div class="orca-df-archive-foot"><button type="button" class="orca-df-archive-act" data-df-arch="unarchive-all">全部取消归档</button></div>' +
    "</div>";
  dfMountDialog(host);

  var body = host.querySelector(".orca-df-archive-body");
  var busy = false;
  var archiveItems = [];
  var archiveShown = DF_LIST_PAGE;
  var archiveSearchEl = host.querySelector("[data-df-arch-search]");
  var archiveSortEl = host.querySelector("[data-df-arch-sort]");

  function renderRows(items) {
    if (!items.length) {
      body.innerHTML = '<div class="orca-df-archive-empty">' + dfT("暂无归档") + "</div>";
      return;
    }
    body.innerHTML = items.map(function (it) {
      var title = String(it.text || "").replace(/\r\n/g, "\n").split("\n").map(function (s) {
        return s.trim();
      }).filter(Boolean)[0] || dfT("(无标题)");
      title = title.slice(0, 80);
      var bid = it.blockId || it.id;
      return (
        '<div class="orca-df-archive-row" data-id="' + orcaEsc(it.id) + '">' +
        '<div class="orca-df-archive-meta">' +
        '<div class="orca-df-archive-title" title="' + orcaEsc(title) + '">' + orcaEsc(title) + "</div>" +
        '<div class="orca-df-archive-sub">' + orcaEsc(it.created || "") +
        ((it.tags && it.tags.length) ? (" · " + orcaEsc(it.tags.map(function (t) { return "#" + t; }).join(" "))) : "") +
        "</div></div>" +
        '<div class="orca-df-archive-actions">' +
        '<button type="button" class="orca-df-archive-act" data-df-arch="open" data-block-id="' + orcaEsc(String(bid)) + '">' + dfT("打开") + "</button>" +
        '<button type="button" class="orca-df-archive-act" data-df-arch="unarchive" data-id="' + orcaEsc(String(bid)) + '">' + dfT("取消归档") + "</button>" +
        "</div></div>"
      );
    }).join("");
  }

  function applyArchiveFilter() {
    var q = archiveSearchEl && archiveSearchEl.value ? String(archiveSearchEl.value).trim().toLowerCase() : "";
    var list = q
      ? archiveItems.filter(function (it) {
        if (!it) return false;
        var blob = String(it.text || "") + " " + ((it.tags || []).join(" ")) + " " + String(it.created || "");
        return blob.toLowerCase().indexOf(q) >= 0;
      })
      : archiveItems;
    if (q && !list.length) {
      body.innerHTML = '<div class="orca-df-archive-empty">' + dfT("没有匹配的条目") + "</div>";
      return;
    }
    var amode = archiveSortEl ? String(archiveSortEl.value || "time-desc") : "time-desc";
    list = list.slice();
    if (amode === "time-asc") {
      list.sort(function (a, b) { return orcaItemTs(a) - orcaItemTs(b); });
    } else if (amode === "title") {
      list.sort(function (a, b) {
        return String(a.text || "").localeCompare(String(b.text || ""));
      });
    } else {
      list.sort(function (a, b) { return orcaItemTs(b) - orcaItemTs(a); });
    }
    var shown = list.slice(0, archiveShown);
    renderRows(shown);
    if (list.length > shown.length) {
      var mt = dfLocaleIsEn()
        ? ("Load more (" + shown.length + " / " + list.length + ")")
        : ("加载更多（" + shown.length + " / " + list.length + "）");
      body.insertAdjacentHTML("beforeend",
        '<div class="orca-df-list-more"><button type="button" class="orca-df-tools-btn" data-df-arch="more">' + mt + "</button></div>");
    }
  }

  function refresh() {
    return OrcaBlocks.listArchivedFeed({ skipHeal: true }).then(function (feed) {
      archiveItems = (feed && feed.items) || [];
      applyArchiveFilter();
      orcaRefreshArchiveFab(ctx);
    }).catch(function () {
      body.innerHTML = '<div class="orca-df-archive-empty">' + dfT("加载失败") + "</div>";
    });
  }

  if (archiveSearchEl) {
    archiveSearchEl.addEventListener("input", function () {
      archiveShown = DF_LIST_PAGE;
      applyArchiveFilter();
    });
  }
  if (archiveSortEl) {
    archiveSortEl.addEventListener("change", function () {
      archiveShown = DF_LIST_PAGE;
      applyArchiveFilter();
    });
  }
  host.addEventListener("mousedown", function (e) {
    if (e.target === host) orcaCloseArchiveDialog();
  });
  host.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-df-arch]");
    if (!btn || !host.contains(btn)) return;
    var act = btn.getAttribute("data-df-arch");
    if (act === "close") {
      orcaCloseArchiveDialog();
      return;
    }
    if (act === "open") {
      var obid = Number(btn.getAttribute("data-block-id"));
      if (obid) orcaOpenInOrca(obid);
      return;
    }
    if (act === "more") {
      archiveShown += DF_LIST_PAGE;
      applyArchiveFilter();
      return;
    }
    if (busy) return;
    if (act === "unarchive") {
      busy = true;
      OrcaBlocks.setEntryArchived(btn.getAttribute("data-id"), false)
        .then(function () {
          orcaShowMessage("已取消归档");
          return orcaRefreshFeed({ keepLimit: true });
        })
        .then(function () {
          if (ctx && typeof ctx.reApp === "function") ctx.reApp();
          return refresh();
        })
        .catch(function (err) {
          orcaShowMessage(String(err && err.message || "取消归档失败"));
        })
        .then(function () { busy = false; });
      return;
    }
    if (act === "unarchive-all") {
      if (!archiveItems.length) return;
      if (dfGetSetting("confirmDelete") && !window.confirm(dfT("全部取消归档？共 ") + archiveItems.length + dfT(" 条"))) return;
      busy = true;
      btn.disabled = true;
      var done = 0;
      var ids = archiveItems.map(function (it) { return it.blockId || it.id; });
      Promise.resolve().then(function loop(i) {
        if (i >= ids.length) return null;
        return OrcaBlocks.setEntryArchived(ids[i], false).then(function () {
          done++;
          btn.textContent = dfT("全部取消归档") + " " + done + "/" + ids.length;
          return loop(i + 1);
        });
      }).then(function () {
        orcaShowMessage("已取消归档");
        return orcaRefreshFeed({ keepLimit: true });
      }).then(function () {
        if (ctx && typeof ctx.reApp === "function") ctx.reApp();
        return refresh();
      }).catch(function (err) {
        orcaShowMessage(String(err && err.message || "取消归档失败"));
      }).then(function () {
        busy = false;
        btn.disabled = false;
        btn.textContent = dfT("全部取消归档");
      });
    }
  });

  function onKey(e) {
    if (e.key === "Escape") {
      orcaCloseArchiveDialog();
      document.removeEventListener("keydown", onKey, true);
    }
  }
  document.addEventListener("keydown", onKey, true);
  refresh();
}

function orcaHandleDfAct(ctx, act, btn) {
  if (typeof orcaHandleToolsAct === "function" && orcaHandleToolsAct(ctx, act, btn)) {
    return;
  }
  if (act === "refresh-feed") {
    orcaManualRefreshFeed(ctx);
    return;
  }
  if (act === "clear-tag") {
    orcaSetTagFilter(ctx, "");
    if (typeof orcaToolsClearQuickFilters === "function") orcaToolsClearQuickFilters(ctx.filters);
    ctx.filters.kw = "";
    orcaPersistFilters();
    orcaRefreshFeed().then(function () { ctx.reApp(); });
    return;
  }
  if (act === "filter-tag") {
    var t = btn.getAttribute("data-tag");
    var on = orcaSetTagFilter(ctx, t);
    orcaRefreshFeed().then(function () {
      ctx.reApp();
      orcaShowMessage(on ? ("已按标签过滤 #" + t) : "已取消标签筛选");
    });
    return;
  }
  if (act === "goto-ref" || act === "open-orca") {
    orcaCollapseAllMoreBars();
    var bid = Number(btn.getAttribute("data-block-id"));
    if (bid) orcaOpenInOrca(bid);
    return;
  }
}

function orcaMountFeed(container, panelId) {
  var el = container;
  el.style.flex = "1 1 auto";
  el.style.alignSelf = "stretch";
  el.style.width = "100%";
  el.style.minWidth = "0";
  el.style.height = "100%";
  el.style.minHeight = "0";
  el.style.overflow = "hidden";
  el.style.position = "relative";
  el.classList.add("orca-df-scope");
  el.classList.toggle("orca-df-dark", orcaIsDark);
  if (orcaCtx) orcaCtx.orcaPanelId = panelId;
  render.renderApp(el, orcaCtx);
  editor.register(orcaCtx, el);
  orcaBindFeedActions(el, orcaCtx);
  orcaEnhanceFeedDom(el, orcaCtx);
  if (orcaCtx.mounts.indexOf(el) < 0) orcaCtx.mounts.push(el);
  return function () {
    orcaCtx.mounts = orcaCtx.mounts.filter(function (m) { return m !== el; });
    if (el.__dfMoreClose) {
      try { document.removeEventListener("click", el.__dfMoreClose, true); } catch (e0) { /* ignore */ }
      el.__dfMoreClose = null;
    }
    if (el.__dfLazyObs) {
      try { el.__dfLazyObs.disconnect(); } catch (e1) { /* ignore */ }
      el.__dfLazyObs = null;
    }
  };
}

function orcaInjectStyles() {
  if (document.getElementById(ORCA_STYLE_ID)) return;
  var style = document.createElement("style");
  style.id = ORCA_STYLE_ID;
  style.textContent = ORCA_CSS;
  document.head.appendChild(style);
}

function orcaDetectDark() {
  try {
    var st = orca.state;
    var t = st && (st.settings && (st.settings.theme || st.settings.appearance) || st.theme || st.themeMode);
    if (t) return String(t).toLowerCase().indexOf("dark") >= 0;
  } catch (e) {}
  try {
    var bg = getComputedStyle(document.body).backgroundColor;
    var m = bg && bg.match(/\d+(\.\d+)?/g);
    if (m && m.length >= 3) {
      var lum = Number(m[0]) * 0.299 + Number(m[1]) * 0.587 + Number(m[2]) * 0.114;
      return lum < 128;
    }
  } catch (e) {}
  return false;
}
function orcaApplyTheme() {
  orcaIsDark = orcaDetectDark();
  document.querySelectorAll(".orca-df-scope").forEach(function (el) {
    el.classList.toggle("orca-df-dark", orcaIsDark);
  });
}
function orcaWatchTheme() {
  orcaApplyTheme();
  try {
    orcaThemeObserver = new MutationObserver(orcaApplyTheme);
    orcaThemeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
  } catch (e) {}
}

// ---------- React 面板：仅 Feed；深度编辑走虎鲸侧栏 ----------
var R = window.React;
var h = function (type, props) {
  var children = Array.prototype.slice.call(arguments, 2);
  return R.createElement.apply(R, [type, props || null].concat(children));
};

function OrcaPanelRenderer(props) {
  var panelId = props && props.panelId;
  var feedRef = R.useRef(null);

  R.useLayoutEffect(function () {
    var un = null;
    orcaWhenReady(function () {
      if (feedRef.current) un = orcaMountFeed(feedRef.current, panelId);
      orcaScheduleFeedSync();
    });
    return function () { if (un) un(); };
  }, [panelId]);

  R.useEffect(function () {
    orcaScheduleFeedSync();
  }, [panelId]);

  return h("div", {
    ref: feedRef,
    className: "orca-df-scope orca-df-host",
    style: { flex: "1 1 auto", alignSelf: "stretch", width: "100%", minWidth: 0, height: "100%", minHeight: 0, overflow: "hidden" }
  });
}

// ---------- 面板打开 ----------
var DF_PANEL_W_KEY = "df-panel-width";
var DF_PANEL_W_DEFAULT = 0.30;

function orcaFindPanelId(root) {
  if (!root || typeof root !== "object") return null;
  if (root.view === ORCA_PANEL_TYPE && root.id) return root.id;
  if (Array.isArray(root.children)) {
    for (var i = 0; i < root.children.length; i++) {
      var r = orcaFindPanelId(root.children[i]);
      if (r) return r;
    }
  }
  return null;
}
function orcaFindGroupOf(root, panelId) {
  if (!root || typeof root !== "object") return null;
  if (Array.isArray(root.children)) {
    for (var i = 0; i < root.children.length; i++) {
      var c = root.children[i];
      if (c && c.id === panelId) return root;
      var r = orcaFindGroupOf(c, panelId);
      if (r) return r;
    }
  }
  return null;
}
function orcaGroupIndexOf(group, panelId) {
  for (var i = 0; i < group.children.length; i++) {
    if (group.children[i].id === panelId) return i;
  }
  return -1;
}
function orcaApplyPanelWidth(targetId, w) {
  var group = orcaFindGroupOf(orca.state.panels, targetId);
  if (!group || !Array.isArray(group.children) || group.children.length < 2) return;
  var idx = orcaGroupIndexOf(group, targetId);
  if (idx < 0) return;
  var w2 = Math.min(0.85, Math.max(0.18, Number(w) || DF_PANEL_W_DEFAULT));
  var oldW = Number(group.children[idx].width) || 0.5;
  var scale = 1;
  var rest = 1 - oldW;
  if (rest > 0.01) scale = (1 - w2) / rest;
  var vals = group.children.map(function (c, i) {
    if (i === idx) return w2;
    return Math.max(0.05, (Number(c.width) || 0.5) * scale);
  });
  try { orca.nav.changeSizes(targetId, vals); } catch (e) {}
}
function orcaRememberPanelWidth(targetId) {
  var group = orcaFindGroupOf(orca.state.panels, targetId);
  if (!group || !Array.isArray(group.children)) return;
  var idx = orcaGroupIndexOf(group, targetId);
  if (idx < 0) return;
  var w = Number(group.children[idx].width);
  if (isNaN(w) || w <= 0) return;
  try { dfSetData(DF_PANEL_W_KEY, Math.round(w * 100) / 100); } catch (e) {}
}
/** 打开面板后：确保插件自带使用说明存在（未手动删除则每次补齐） */
function orcaMaybeInsertTutorial() {
  if (!OrcaBlocks || typeof OrcaBlocks.ensureTutorialInserted !== "function") return;
  orcaWhenReady(function () {
    OrcaBlocks.ensureTutorialInserted().then(function (res) {
      if (!res || res.skipped) return;
      orcaMuteFeedSync(2500);
      return orcaRefreshFeed().then(function () {
        if (orcaCtx && typeof orcaCtx.reApp === "function") orcaCtx.reApp();
        if (res.created) orcaShowMessage("已插入使用说明（置顶）");
        else if (res.repaired) orcaShowMessage("已补全使用说明正文");
      });
    }).catch(function (e) {
      console.warn("[orca-diaryflow] insert tutorial failed", e);
    });
  });
}

function orcaOpenPanel() {
  try {
    var active = orca.state.activePanel;
    if (!active) {
      orca.notify("warn", dfT("当前没有可用的面板"), { title: dfT("日记流") });
      return;
    }
    var existed = orcaFindPanelId(orca.state.panels);
    var targetId = existed;
    if (existed) {
      orcaRememberPanelWidth(existed);
    } else {
      targetId = orca.nav.addTo(active, "right", { view: ORCA_PANEL_TYPE, viewArgs: {}, viewState: {} });
      if (!targetId) {
        orca.notify("error", dfT("无法创建日记流面板"), { title: dfT("日记流") });
        return;
      }
      dfGetData(DF_PANEL_W_KEY).then(function (v) {
        var w = typeof v === "number" ? v : parseFloat(v);
        if (!isNaN(w) && w > 0.1 && w < 0.9) orcaApplyPanelWidth(targetId, w);
        else orcaApplyPanelWidth(targetId, DF_PANEL_W_DEFAULT);
      });
    }
    orca.nav.goTo(ORCA_PANEL_TYPE, {}, targetId);
    try {
      var vp = orca.nav.findViewPanel(targetId, orca.state.panels);
      if (vp && !vp.wide) vp.wide = true;
    } catch (e) {}
    setTimeout(function () { try { orca.nav.switchFocusTo(targetId); } catch (e) {} }, 80);
    orcaMaybeInsertTutorial();
  } catch (e) {
    console.error("[orca-diaryflow] openPanel", e);
  }
}

var ORCA_ICON_SVG = '<svg viewBox="0 0 24 24" width="18" height="18"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="currentColor" opacity="0.07"/><path d="M4.5 8.5c2.3 0 3.7 1.6 4.8 3.2 1.1-1.6 2.5-3.2 4.8-3.2s3.7 1.6 4.8 3.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.3" cy="15.8" r="2" fill="currentColor"/><circle cx="14.7" cy="15.8" r="2" fill="currentColor"/></svg>';

function orcaRegisterHeadbar() {
  try {
    if (orca.state.headbarButtons && orca.state.headbarButtons[ORCA_BTN_ID] == null) {
      var Button = orca.components.Button;
      orca.headbar.registerHeadbarButton(ORCA_BTN_ID, function () {
        return h(Button, { variant: "plain", onClick: orcaOpenPanel, title: dfT("打开日记流") },
          h("span", { className: "orca-df-hb-icon", dangerouslySetInnerHTML: { __html: ORCA_ICON_SVG } }));
      });
    }
  } catch (e) {
    console.warn("[orca-diaryflow] register headbar failed", e);
  }
}

function orcaRegisterSidetool() {
  try {
    if (orca.state.editorSidetools && orca.state.editorSidetools[ORCA_SIDETOOL_ID] == null) {
      var Button = orca.components.Button;
      orca.editorSidetools.registerEditorSidetool(ORCA_SIDETOOL_ID, {
        render: function () {
          return h(Button, { variant: "plain", className: "orca-block-editor-sidetools-btn", title: dfT("打开日记流"), onClick: orcaOpenPanel },
            h("span", { className: "orca-df-hb-icon", dangerouslySetInnerHTML: { __html: ORCA_ICON_SVG } }));
        }
      });
    }
  } catch (e) {
    console.warn("[orca-diaryflow] register sidetool failed", e);
  }
}

async function load(name) {
  orcaPluginName = name;
  orcaInjectStyles();
  orcaWatchTheme();
  orcaWatchLocale();
  orcaBindCalendarJump();
  await dfRegisterSettings();
  orcaMomentsData = storage.defaultData();
  orcaCtx = orcaBuildCtx();

  (async function boot() {
    try {
      await OrcaBlocks.migrateMomentsRecords(function () { return storage.loadData(orcaShim); });
    } catch (e) {
      console.warn("[orca-diaryflow] migrate failed", e);
    }
    try {
      if (OrcaBlocks.purgeExpiredTrash) await OrcaBlocks.purgeExpiredTrash();
    } catch (eTrash) {
      console.warn("[orca-diaryflow] trash purge expired", eTrash);
    }
    try {
      if (OrcaBlocks.cleanupLegacyOverlays) await OrcaBlocks.cleanupLegacyOverlays();
    } catch (eClean) {
      console.warn("[orca-diaryflow] cleanup legacy overlays", eClean);
    }
    try {
      await orcaLoadFilters();
    } catch (eFilters) {
      console.warn("[orca-diaryflow] load filters failed", eFilters);
    }
    try {
      await orcaRefreshFeed();
    } catch (e) {
      console.warn("[orca-diaryflow] refresh feed failed", e);
      try {
        var legacy = await storage.loadData(orcaShim);
        orcaMomentsData = legacy;
      } catch (e2) { /* ignore */ }
    }
    orcaReady = true;
    orcaStartFeedSyncWatch();
    orcaScheduleAutoMediaCleanup();
    orcaScheduleAutoBackup();
    var cbs = orcaReadyCbs;
    orcaReadyCbs = [];
    cbs.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
    if (orcaCtx) orcaCtx.reApp();
  })();

  try { orca.commands.registerCommand(orcaPluginName + ".open", orcaOpenPanel, dfT("打开日记流面板")); } catch (e) {}
  try {
    orca.panels.registerPanel(ORCA_PANEL_TYPE, OrcaPanelRenderer);
    orcaRegisteredPanel = true;
  } catch (e) {
    console.warn("[orca-diaryflow] register panel failed", e);
  }
  orcaRegisterHeadbar();
  orcaRegisterSidetool();
  console.log("[orca-diaryflow] 日记流插件已加载（深融合虎鲸）");
  return true;
}

async function unload() {
  orcaStopFeedSyncWatch();
  if (orcaSettingsLocaleUnsub) {
    try { orcaSettingsLocaleUnsub(); } catch (e) { /* ignore */ }
    orcaSettingsLocaleUnsub = null;
  }
  try { orca.commands.unregisterCommand(orcaPluginName + ".open"); } catch (e) {}
  try { orca.headbar.unregisterHeadbarButton(ORCA_BTN_ID); } catch (e) {}
  try {
    if (orca.state.editorSidetools && orca.state.editorSidetools[ORCA_SIDETOOL_ID] != null) {
      orca.editorSidetools.unregisterEditorSidetool(ORCA_SIDETOOL_ID);
    }
  } catch (e) {}
  if (orcaRegisteredPanel) {
    try { orca.panels.unregisterPanel(ORCA_PANEL_TYPE); } catch (e) {}
    orcaRegisteredPanel = false;
  }
  if (orcaThemeObserver) {
    try { orcaThemeObserver.disconnect(); } catch (e) {}
    orcaThemeObserver = null;
  }
  var style = document.getElementById(ORCA_STYLE_ID);
  if (style && style.parentNode) style.parentNode.removeChild(style);
  DF_ASSETS.dispose();
  orcaReady = false;
  console.log("[orca-diaryflow] 日记流插件已卸载");
}

export { load, unload };

if (typeof window !== "undefined") {
  window.OrcaDiaryflowPlugin = { load: load, unload: unload };
}
