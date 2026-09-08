// ============================================================
// src/orca-entry.js — Orca Note 适配层（日记流 orca-diaryflow）
// 面板注册 / 顶栏按钮 / 插件文件区图片存储 / 深浅色主题
// ============================================================

var ORCA_PANEL_TYPE = "orca-diaryflow.panel";
var ORCA_BTN_ID = "orca-diaryflow.button";
var ORCA_STYLE_ID = "orca-diaryflow-style";
var orcaPluginName = "";
var orcaRegisteredPanel = false;
var orcaReady = false;
var orcaReadyCbs = [];
var orcaMomentsData = null;
var orcaCtx = null;
var orcaThemeObserver = null;
var orcaIsDark = false;

globalThis.__DF_IS_DARK = function () { return orcaIsDark; };

// ---------- 媒体资源层：插件文件区(media/) + blob URL ----------
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
  // 通道1：官方 get-plugin-file — type 只接受 "string"|"buffer"（orca.d.ts），buffer 返回 ArrayBuffer
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
  // 通道2：read-aichat-image-as-data-url（mreader/mcard 已验证的图片读取通道，返回 data URL）
  try {
    var dataUrl = await orca.invokeBackend("read-aichat-image-as-data-url", "./plugins/" + orcaPluginName + "/" + rel);
    if (typeof dataUrl === "string" && dataUrl.indexOf(",") >= 0) {
      var b64 = dataUrl.substring(dataUrl.indexOf(",") + 1);
      if (b64.trim().length > 0) return dfBase64ToBytes(b64);
    }
  } catch (e2) { /* 通道不存在则忽略 */ }
  return null;
}

var DF_ASSETS = {
  map: new Map(),
  loading: new Map(),
  resolve(s) {
    if (typeof s === "string" && s.startsWith(DF_MEDIA_PREFIX)) {
      var u = this.map.get(s);
      return u || DF_TRANSPARENT_GIF;
    }
    return s;
  },
  async load(ref) {
    if (this.map.has(ref)) return this.map.get(ref);
    if (this.loading.has(ref)) return this.loading.get(ref);
    var self = this;
    var p = (async () => {
      var rel = "media/" + ref.slice(DF_MEDIA_PREFIX.length);
      var bytes = await dfPluginFileBytes(rel);
      if (!bytes || !bytes.byteLength) return null;
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
      if (typeof s === "string" && s.startsWith(DF_MEDIA_PREFIX)) refs.add(s);
    });
    ((data && data.items) || []).forEach(function (it) {
      (it.images || []).forEach(function (s) {
        if (typeof s === "string" && s.startsWith(DF_MEDIA_PREFIX)) refs.add(s);
      });
    });
    var arr = Array.from(refs);
    await Promise.all(arr.map((r) => this.load(r).catch(() => null)));
  },
  async save(file, name) {
    var rel = "media/" + name;
    var buf = await file.arrayBuffer();
    try {
      await orca.invokeBackend("set-plugin-file", orcaPluginName, rel, buf);
    } catch (e1) {
      console.warn("[orca-diaryflow] set-plugin-file(arrayBuffer) failed", e1);
      await orca.invokeBackend("set-plugin-file", orcaPluginName, rel, dfBytesToBase64(new Uint8Array(buf)), "base64");
    }
    var ref = DF_MEDIA_PREFIX + name;
    this.map.set(ref, URL.createObjectURL(file));
    this.indexAdd(name);
    return ref;
  },
  async indexAdd(name) {
    try {
      var idx = await dfGetData("media-index");
      if (!Array.isArray(idx)) idx = [];
      if (idx.indexOf(name) < 0) {
        idx.push(name);
        await dfSetData("media-index", idx);
      }
    } catch (e) { /* ignore */ }
  },
  async listMedia() {
    try {
      var r = await orca.invokeBackend("list-plugin-files", orcaPluginName, "media");
      var arr = null;
      if (Array.isArray(r)) arr = r;
      else if (r && Array.isArray(r.files)) arr = r.files;
      else if (r && Array.isArray(r.data)) arr = r.data;
      if (arr) {
        return arr
          .map(function (x) { return typeof x === "string" ? x : (x && (x.name || x.path)) || ""; })
          .filter(function (n) { return n && String(n).indexOf("/") < 0; });
      }
    } catch (e) { /* fallback below */ }
    try {
      var idx = await dfGetData("media-index");
      return Array.isArray(idx) ? idx : [];
    } catch (e) {
      return [];
    }
  },
  async toDataUrl(ref) {
    if (typeof ref !== "string" || !ref.startsWith(DF_MEDIA_PREFIX)) return ref || "";
    var rel = "media/" + ref.slice(DF_MEDIA_PREFIX.length);
    var bytes = await dfPluginFileBytes(rel);
    if (!bytes || !bytes.byteLength) return ref;
    return "data:" + dfMimeOf(rel) + ";base64," + dfBytesToBase64(bytes);
  },
  dispose() {
    this.map.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} });
    this.map.clear();
  }
};
globalThis.__DF_ASSETS = DF_ASSETS;

// ---------- 插件数据访问（Orca 的 set-plugin-data 只接受 string/number/ArrayBuffer/null，必须序列化） ----------
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

// ---------- 插件数据 shim（兼容 SiYuan Plugin.loadData/saveData） ----------
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
  try { orca.notify("info", m); } catch (e) { console.log("[orca-diaryflow]", m); }
}

// ---------- 模块实例 ----------
var storage = require_storage();
var render = require_render();
var editor = require_editor();

function orcaBuildCtx() {
  var c = {
    plugin: orcaShim,
    filters: { kw: "" },
    view: "feed",
    calYear: new Date().getFullYear(),
    mounts: [],
    data: function () { return orcaMomentsData; },
    save: function () { return storage.saveData(orcaShim, orcaMomentsData); },
    showMessage: orcaShowMessage
  };
  c.reApp = function () {
    c.mounts.forEach(function (el) { render.renderApp(el, c); });
  };
  return c;
}

function orcaWhenReady(fn) {
  if (orcaReady) { try { fn(); } catch (e) { console.error(e); } }
  else orcaReadyCbs.push(fn);
}

function orcaMount(container) {
  var el = container;
  el.style.height = "100%";
  el.style.minHeight = "0";
  el.style.overflow = "hidden";
  el.style.position = "relative";
  el.classList.add("orca-df-scope");
  el.classList.toggle("orca-df-dark", orcaIsDark);
  render.renderApp(el, orcaCtx);
  editor.register(orcaCtx, el);
  if (orcaCtx.mounts.indexOf(el) < 0) orcaCtx.mounts.push(el);
  return function () {
    orcaCtx.mounts = orcaCtx.mounts.filter(function (m) { return m !== el; });
  };
}

// ---------- 样式注入 ----------
function orcaInjectStyles() {
  if (document.getElementById(ORCA_STYLE_ID)) return;
  var style = document.createElement("style");
  style.id = ORCA_STYLE_ID;
  style.textContent = ORCA_CSS;
  document.head.appendChild(style);
}

// ---------- 深浅色主题 ----------
function orcaDetectDark() {
  try {
    var st = orca.state;
    var t = st && (st.settings && (st.settings.theme || st.settings.appearance) || st.theme);
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
  try { return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches; } catch (e) {}
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

// ---------- React 面板 ----------
var R = window.React;
var h = function (type, props) {
  var children = Array.prototype.slice.call(arguments, 2);
  return R.createElement.apply(R, [type, props || null].concat(children));
};

function OrcaPanelRenderer() {
  var ref = R.useRef(null);
  R.useLayoutEffect(function () {
    var un = null;
    orcaWhenReady(function () { un = orcaMount(ref.current); });
    return function () { if (un) un(); };
  }, []);
  return h("div", { ref: ref, className: "orca-df-scope orca-df-host" });
}

// ---------- 面板打开（侧栏优化：默认加宽 + 记住宽度） ----------
var DF_PANEL_W_KEY = "df-panel-width";
var DF_PANEL_W_DEFAULT = 0.42; // 默认宽度（若从未保存）

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
// 把 targetId 面板宽度设为 w，同一行其余面板等比例缩放
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
// 记住当前面板宽度（下次打开恢复）
function orcaRememberPanelWidth(targetId) {
  var group = orcaFindGroupOf(orca.state.panels, targetId);
  if (!group || !Array.isArray(group.children)) return;
  var idx = orcaGroupIndexOf(group, targetId);
  if (idx < 0) return;
  var w = Number(group.children[idx].width);
  if (isNaN(w) || w <= 0) return;
  try { dfSetData(DF_PANEL_W_KEY, Math.round(w * 100) / 100); } catch (e) {}
}
function orcaOpenPanel() {
  try {
    var active = orca.state.activePanel;
    if (!active) {
      orca.notify("warn", "当前没有可用的面板", { title: "日记流" });
      return;
    }
    var existed = orcaFindPanelId(orca.state.panels);
    var targetId = existed;
    if (existed) {
      // 已存在：记住当前宽度（用户可能拖动过）
      orcaRememberPanelWidth(existed);
    } else {
      targetId = orca.nav.addTo(active, "right", { view: ORCA_PANEL_TYPE, viewArgs: {}, viewState: {} });
      if (!targetId) {
        orca.notify("error", "无法创建日记流面板", { title: "日记流" });
        return;
      }
      // 新建：应用保存过的宽度（无则默认加宽）
      dfGetData(DF_PANEL_W_KEY).then(function (v) {
        var w = typeof v === "number" ? v : parseFloat(v);
        if (!isNaN(w) && w > 0.1 && w < 0.9) orcaApplyPanelWidth(targetId, w);
        else orcaApplyPanelWidth(targetId, DF_PANEL_W_DEFAULT);
      });
    }
    orca.nav.goTo(ORCA_PANEL_TYPE, {}, targetId);
    setTimeout(function () { try { orca.nav.switchFocusTo(targetId); } catch (e) {} }, 80);
  } catch (e) {
    console.error("[orca-diaryflow] openPanel", e);
  }
}

// ---------- 顶栏按钮 ----------
var ORCA_ICON_SVG = '<svg viewBox="0 0 24 24" width="18" height="18"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="currentColor" opacity="0.07"/><path d="M4.5 8.5c2.3 0 3.7 1.6 4.8 3.2 1.1-1.6 2.5-3.2 4.8-3.2s3.7 1.6 4.8 3.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.3" cy="15.8" r="2" fill="currentColor"/><circle cx="14.7" cy="15.8" r="2" fill="currentColor"/></svg>';

function orcaRegisterHeadbar() {
  try {
    if (orca.state.headbarButtons && orca.state.headbarButtons[ORCA_BTN_ID] == null) {
      var Button = orca.components.Button;
      orca.headbar.registerHeadbarButton(ORCA_BTN_ID, function () {
        return h(Button, { variant: "plain", onClick: orcaOpenPanel, title: "打开日记流" },
          h("span", { className: "orca-df-hb-icon", dangerouslySetInnerHTML: { __html: ORCA_ICON_SVG } }));
      });
    }
  } catch (e) {
    console.warn("[orca-diaryflow] register headbar failed", e);
  }
}

// ---------- 生命周期 ----------
async function load(name) {
  orcaPluginName = name;
  orcaInjectStyles();
  orcaWatchTheme();
  orcaMomentsData = storage.defaultData();
  orcaCtx = orcaBuildCtx();
  storage.loadData(orcaShim).then(async function (d) {
    orcaMomentsData = d;
    try { await DF_ASSETS.hydrate(d); } catch (e) { console.warn("[orca-diaryflow] hydrate assets failed", e); }
    orcaReady = true;
    var cbs = orcaReadyCbs;
    orcaReadyCbs = [];
    cbs.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
  });
  try { orca.commands.registerCommand(orcaPluginName + ".open", orcaOpenPanel, "打开日记流面板"); } catch (e) {}
  try {
    orca.panels.registerPanel(ORCA_PANEL_TYPE, OrcaPanelRenderer);
    orcaRegisteredPanel = true;
  } catch (e) {
    console.warn("[orca-diaryflow] register panel failed", e);
  }
  orcaRegisterHeadbar();
  console.log("[orca-diaryflow] 日记流插件已加载");
  return true;
}

async function unload() {
  try { orca.commands.unregisterCommand(orcaPluginName + ".open"); } catch (e) {}
  try { orca.headbar.unregisterHeadbarButton(ORCA_BTN_ID); } catch (e) {}
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
