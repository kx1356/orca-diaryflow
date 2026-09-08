// orca-diaryflow v0.1.0 — built from siyuan-diaryflow by build.mjs
// Orca Note adaptation: panel, plugin-file media assets, theme scoping
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};


// src/storage.js
var require_storage = __commonJS({
  "src/storage.js"(exports2, module2) {
    var STORAGE_KEY = "moments-records";
    function defaultData() {
      return {
        config: {
          nickname: "\u6708\u4EAE",
          signature: "\u8A00\u5FF5\u541B\u5B50\uFF0C\u6E29\u5176\u5982\u7389",
          lockEnabled: false,
          lockPasscode: "",
          lockBg: ""
        },
        items: []
      };
    }
    function normalize(data) {
      const base = defaultData();
      if (data && typeof data === "object") {
        const cfg = data.config || {};
        base.config.nickname = cfg.nickname || base.config.nickname;
        base.config.signature = cfg.signature || base.config.signature;
        if (cfg.avatar) base.config.avatar = cfg.avatar;
        if (cfg.cover) base.config.cover = cfg.cover;
        base.config.lockEnabled = !!cfg.lockEnabled;
        if (cfg.lockPasscode) base.config.lockPasscode = String(cfg.lockPasscode);
        if (cfg.lockBg) base.config.lockBg = cfg.lockBg;
        if (Array.isArray(data.items)) {
          base.items = data.items.map(normalizeItem).filter(Boolean);
        }
      }
      return base;
    }
    function toTsFromCreated(created) {
      if (!created) return Date.now();
      const d = new Date(created.replace ? created.replace(" ", "T").replace(/-/g, "/") : created);
      return isNaN(d.getTime()) ? Date.now() : d.getTime();
    }
    function normalizeItem(m) {
      if (!m || !m.id) return null;
      return {
        id: String(m.id),
        text: m.text || "",
        images: Array.isArray(m.images) ? m.images.slice(0, 9) : [],
        link: m.link || "",
        linkTitle: m.linkTitle || "",
        created: m.created || "",
        createdAt: m.createdAt || toTsFromCreated(m.created),
        liked: !!m.liked,
        comments: Array.isArray(m.comments) ? m.comments.filter((c) => c && c.text) : [],
        pinned: !!m.pinned,
        location: m.location || "",
        tags: Array.isArray(m.tags) ? m.tags.filter(Boolean).slice(0, 20) : []
      };
    }
    async function loadData(plugin) {
      const raw = await plugin.loadData(STORAGE_KEY).catch(() => null);
      return normalize(raw);
    }
    async function saveData(plugin, data) {
      await plugin.saveData(STORAGE_KEY, data).catch(() => null);
      return data;
    }
    module2.exports = { STORAGE_KEY, defaultData, normalize, normalizeItem, loadData, saveData };
  }
});


// src/util.js
var require_util = __commonJS({
  "src/util.js"(exports2, module2) {
    function esc(s) {
      const __r = globalThis.__DF_ASSETS ? globalThis.__DF_ASSETS.resolve(s) : s;
      return String(__r == null ? "" : __r).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    function p2(n) {
      return String(n).padStart(2, "0");
    }
    function fmtDisplay(t) {
      if (!t) return "";
      const d = new Date(t.replace ? t.replace(" ", "T").replace(/-/g, "/") : t);
      if (isNaN(d.getTime())) return String(t);
      return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
    }
    function toTs(item) {
      if (item.createdAt) return Number(item.createdAt) || Date.now();
      if (item.created) {
        const d = new Date(item.created.replace ? item.created.replace(" ", "T").replace(/-/g, "/") : item.created);
        if (!isNaN(d.getTime())) return d.getTime();
      }
      return Date.now();
    }
    function todayKey(d) {
      return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    }
    function dateKey(t) {
      const d = new Date(t);
      return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    }
    function ymKey(t) {
      const d = new Date(t);
      return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
    }
    function monthLabel(ym) {
      const [y, m] = String(ym).split("-").map(Number);
      if (!y || !m) return String(ym);
      return `${y}\u5E74${m}\u6708`;
    }
    function genId() {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }
    function fmtRelative(ts, now = Date.now()) {
      const diff = now - ts;
      const min = Math.floor(diff / 6e4);
      if (min < 1) return "\u521A\u521A";
      if (min < 60) return `${min}\u5206\u949F\u524D`;
      const hour = Math.floor(min / 60);
      if (hour < 24) return `${hour}\u5C0F\u65F6\u524D`;
      const day = Math.floor(hour / 24);
      if (day < 7) return `${day}\u5929\u524D`;
      const d = new Date(ts);
      return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    }
    module2.exports = { esc, p2, fmtDisplay, toTs, todayKey, dateKey, ymKey, monthLabel, genId, fmtRelative };
  }
});


// src/render.js
var require_render = __commonJS({
  "src/render.js"(exports2, module2) {
    var { esc, fmtRelative, toTs, dateKey, p2 } = require_util();
    var videoThumbCache = /* @__PURE__ */ new Map();
    function getVideoThumb(src) {
      if (videoThumbCache.has(src)) return Promise.resolve(videoThumbCache.get(src));
      return new Promise((resolve) => {
        const v = document.createElement("video");
        v.muted = true;
        v.playsInline = true;
        v.preload = "auto";
        let settled = false;
        const done = (dataUrl) => {
          if (settled) return;
          settled = true;
          videoThumbCache.set(src, dataUrl || "");
          resolve(dataUrl || "");
          try {
            v.removeAttribute("src");
            v.load();
          } catch (e) {
          }
        };
        v.addEventListener("loadeddata", () => {
          try {
            v.currentTime = Math.min(0.1, (v.duration || 1) / 2);
          } catch (e) {
            done("");
          }
        });
        v.addEventListener("seeked", () => {
          try {
            const w = v.videoWidth || 300;
            const h = v.videoHeight || 300;
            const scale = Math.min(1, 300 / Math.max(w, h));
            const c = document.createElement("canvas");
            c.width = Math.max(1, Math.round(w * scale));
            c.height = Math.max(1, Math.round(h * scale));
            c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
            done(c.toDataURL("image/jpeg", 0.75));
          } catch (e) {
            done("");
          }
        });
        v.addEventListener("error", () => done(""));
        v.src = src;
        v.load();
        setTimeout(() => done(""), 1e4);
      });
    }
    function hydrateVideoThumbs(root) {
      const scope = root || document;
      scope.querySelectorAll("video[data-vthumb]").forEach((v) => {
        if (v.dataset.thumbDone) return;
        v.dataset.thumbDone = "1";
        getVideoThumb(v.dataset.vthumb).then((poster) => {
          if (poster && v.isConnected) v.poster = poster;
        });
      });
      scope.querySelectorAll("img[data-vthumb]").forEach((im) => {
        if (im.dataset.thumbDone) return;
        im.dataset.thumbDone = "1";
        getVideoThumb(im.dataset.vthumb).then((poster) => {
          if (poster && im.isConnected) im.src = poster;
        });
      });
    }
    function avatarHtml(avatar, nickname) {
      if (avatar) return `<img class="mom-avatar" src="${esc(avatar)}" alt="">`;
      return `  <div class="mom-avatar mom-avatar-ph">${esc((nickname || "\u6708").slice(0, 1))}</div>`;
    }
    var ICONS = {
      upload: "M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z",
      image: "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.6 13.4l2.4 3.2 3.4-4.4 4 5.8H5l3.6-4.6z",
      calendar: "M20 3h-1V1h-2v2H7V1H5v2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H4V8h16v13z",
      trash: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
      settings: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z",
      edit: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
      pin: "M16 12V4h1V2H7v2h1v8l-2 2v2h5v4l1 1 1-1v-4h5v-2l-2-2z",
      clock: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z",
      mark: "M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"
    };
    function ico(name, size) {
      const s = size || 16;
      const dim = `style="width:${s}px;height:${s}px;fill:currentColor"`;
      if (name === "outline") return `<svg viewBox="0 0 24 24" ${dim}><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>`;
      if (name === "heart") return `<svg viewBox="0 0 24 24" ${dim}><path fill="#e74c3c" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>`;
      const d = ICONS[name] || name;
      return `<svg viewBox="0 0 24 24" ${dim}><path d="${d}"></path></svg>`;
    }
    function dateStr(it) {
      const d = new Date(toTs(it));
      return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    }
    function coverHtml(cfg, items) {
      const cover = cfg.cover ? `<img class="mom-cover-img" data-cover-img src="${esc(cfg.cover)}" alt="cover" loading="lazy" decoding="async" fetchpriority="low">` : `<div class="mom-cover-default" data-cover-img></div>`;
      const total = (items || []).length;
      const now = new Date();
      const monthCnt = (items || []).filter((it) => {
        const d = new Date(toTs(it));
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }).length;
      const stats = `${total > 0 ? `\u5171 ${total} \u7BC7` : "\u6682\u65E0\u8BB0\u5F55"}${monthCnt > 0 ? ` \u00B7 \u672C\u6708 ${monthCnt} \u7BC7` : ""}`;
      return `
    <header class="mom-cover">
      <div class="mom-cover-bg">
        ${cover}
        <div class="mom-cover-shade"></div>
        <span class="mom-cover-stats">${stats}</span>
        <button class="mom-cover-settings" data-action="open-settings" title="\u65E5\u8BB0\u6D41\u8BBE\u7F6E">${ico("settings", 18)}</button>
      </div>
    </header>`;
    }
    function renderApp(container, ctx) {
      const data = ctx.data();
      const cfg = data.config || {};
      const items = data.items || [];
      if (cfg.lockEnabled && cfg.lockPasscode && ctx.__unlocked !== true) {
        return renderLockScreen(container, ctx);
      }
      const view = ctx.view || "feed";
      container.innerHTML = `
    <div class="mom-root">
      <div class="mom-scroll" data-scroll>
        ${coverHtml(cfg, items)}
        <div class="mom-signature">
          <div class="mom-signature-tools">            <button class="mom-cover-tool" data-act="calendar" title="\u65E5\u8BB0\u6D41\u65E5\u5386">${ico("calendar")}<span>\u65E5\u5386</span></button>
          </div>
          <div class="mom-signature-text">${esc(cfg.signature)}</div>
        </div>
        ${renderPinnedStrip(ctx)}
        <main class="mom-list" data-list></main>
        <div class="mom-bottom-space"></div>
      </div>
      <div class="mom-fab-stack${ctx.plugin && ctx.plugin.isMobile ? " is-mobile" : ""}">
        <button class="mom-outline-fab" data-action="open-outline" title="\u6708\u4EFD\u5927\u7EB2">${ico("outline", 18)}</button>
        <button class="mom-outline-fab" data-action="open-editor" title="\u53D1\u8868\u65E5\u8BB0">${ico("edit", 18)}</button>
      </div>
      <div class="mom-publish-page" data-publish-page hidden></div>
      <div class="mom-lightbox" data-lightbox hidden></div>
    </div>`;
      ctx.container = container;
      ctx.scrollEl = container.querySelector("[data-scroll]");
      ctx.listEl = container.querySelector("[data-list]");
      ctx.lightbox = container.querySelector("[data-lightbox]");
      ctx.publishPage = container.querySelector("[data-publish-page]");
      if (view === "calendar") renderCalendar(ctx);
      else renderList(ctx);
      hydrateVideoThumbs(container);
    }
    function renderPinnedStrip(ctx) {
      const items = (ctx.data().items || []).filter((m) => m.pinned);
      if (!items.length) return "";
      const sorted = items.slice().sort((a, b) => toTs(b) - toTs(a));
      const getCols = (n) => n <= 1 ? 1 : n === 2 ? 2 : n === 3 ? 3 : 2;
      const groups = sorted.map((m) => {
        const imgs = (m.images || []).filter(Boolean);
        const id = esc(m.id);
        if (!imgs.length) {
          const raw = String(m.text || "\u7F6E\u9876").slice(0, 80);
          const mode = raw.length <= 10 ? "center" : "flow";
          return `<button class="mom-pin-group" data-action="jump-mid" data-id="${id}" style="grid-template-columns:repeat(1,88px)">
        <div class="mom-pin-thumb mom-pin-thumb-text"><span class="mom-pin-text mom-pin-text-${mode}">${esc(raw)}</span></div>
      </button>`;
        }
        const single = imgs.length <= 1;
        const cols = getCols(imgs.length);
        const size = single ? 88 : 44;
        const show = imgs.slice(0, 4);
        const extra = imgs.length > 4 ? imgs.length - 4 : 0;
        const cells = show.map((src, idx) => {
          const more = idx === 3 && extra > 0 ? `<div class="mom-pin-thumb-more">+${extra}</div>` : "";
          const wrap = single ? ' class="mom-pin-thumb mom-pin-thumb-single"' : ' class="mom-pin-thumb"';
          const isVid = isVideoSrc(src);
          const imgAttrs = isVid
            ? `class="mom-pin-thumb-video" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" data-vthumb="${esc(src)}"`
            : `src="${esc(src)}" loading="lazy"`;
          return `<div${wrap}><img ${imgAttrs} alt="\u7F6E\u9876">${more}</div>`;
        }).join("");
        return `<button class="mom-pin-group" data-action="jump-mid" data-id="${id}" style="grid-template-columns:repeat(${cols},${size}px)">${cells}</button>`;
      }).join("");
      return `<div class="mom-pin-strip" title="\u70B9\u51FB\u67E5\u770B\u7F6E\u9876\u52A8\u6001">
    <span class="mom-pin-strip-label">\u7F6E\u9876</span>
    <div class="mom-pin-strip-thumbs">${groups}</div>
  </div>`;
    }
    function applyFilters(ctx) {
      const f = ctx.filters;
      const sorted = (ctx.data().items || []).slice().sort((a, b) => {
        if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
        return toTs(b) - toTs(a);
      });
      return sorted.filter((it) => {
        if (f.kw) {
          const kw = String(f.kw).toLowerCase();
          const t = (((it.text || "") + " " + ((it.tags || []).join(" "))) + "").toLowerCase();
          if (kw.startsWith("#")) {
            const tagOnly = ((it.tags || []).map((g) => "#" + g).join(" ")).toLowerCase();
            if (!tagOnly.includes(kw)) return false;
          } else if (!t.includes(kw)) {
            return false;
          }
        }
        return true;
      });
    }
    function renderList(ctx) {
      const el = ctx.listEl;
      if (!el) return;
      const list = applyFilters(ctx);
      if (!list.length) {
        const hasAny = (ctx.data().items || []).length > 0;
        el.innerHTML = hasAny
          ? `<div class="mom-empty mom-empty-result">\u6CA1\u6709\u7B26\u5408\u5F53\u524D\u6761\u4EF6\u7684\u52A8\u6001</div>`
          : `<div class="mom-empty"><div class="mom-empty-ico">\u{1F4CB}</div><p class="mom-empty-title">\u8FD8\u6CA1\u6709\u52A8\u6001</p><p class="mom-empty-sub">\u8BB0\u5F55\u4E0B\u8FD9\u4E00\u523B\uFF0C\u8BA9\u65E5\u5B50\u53EF\u4EE5\u56DE\u5934\u3002</p><p class="mom-empty-hint">\u53EF\u4EE5\u5199\u6587\u5B57\u3001\u4E0A\u4F20\u56FE\u7247\uFF0C\u8FD8\u80FD\u52A0\u4E0A\u6807\u7B7E \u2022 \u70B9\u51FB\u4E0B\u65B9\u6309\u94AE\u53D1\u5E03\u7B2C\u4E00\u6761</p><button class="mom-btn mom-btn-primary mom-empty-btn" data-action="open-editor" type="button">\uFF0B \u53D1\u5E03\u7B2C\u4E00\u6761</button></div>`;
        return;
      }
      let html = "";
      let lastKey = null;
      for (const it of list) {
        const k = monthKeyOf(it);
        if (k !== lastKey) {
          lastKey = k;
          html += dateGroupHtml(it);
        }
        html += cardHtml(ctx, it);
      }
      el.innerHTML = html;
      applyListFolding(el, ctx.foldLines);
      hydrateVideoThumbs(el);
    }
    function monthKeyOf(it) {
      const d = new Date(toTs(it));
      if (isNaN(d.getTime())) return "unknown";
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    function dateGroupHtml(it) {
      const d = new Date(toTs(it));
      let label;
      if (isNaN(d.getTime())) label = "\u672A\u6807\u6CE8\u65E5\u671F";
      else {
        const now = /* @__PURE__ */ new Date();
        if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) label = "\u672C\u6708";
        else label = `${d.getFullYear()}\u5E74${d.getMonth() + 1}\u6708`;
      }
      return `<div class="north-luna-moments-date-group"><span class="north-luna-moments-date-group-text">${esc(label)}</span></div>`;
    }
    function tagsHtml(it) {
      const tags = (it.tags || []).filter(Boolean);
      if (!tags.length) return "";
      return `<div class="north-luna-moments-tags">${tags.map((t) => `<span class="north-luna-moments-tag" data-action="search-tag" data-tag="${esc(t)}">#${esc(t)}</span>`).join("")}</div>`;
    }
    function metaTags(it) {
      const parts = [];
      if (it.location) parts.push(`<span class="north-luna-moments-meta-item">${esc(it.location)}</span>`);
      parts.push(`<span class="north-luna-moments-meta-item">${dateStr(it)}</span>`);
      return `<span class="north-luna-moments-meta-tags">${parts.join("")}</span>`;
    }
    function likedIndicatorHtml() {
      return `<span class="north-luna-moments-liked-indicator" title="\u5DF2\u70B9\u8D5E">
    <svg viewBox="0 0 24 24" width="15" height="15"><path fill="#e74c3c" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>
  </span>`;
    }
    function popupBtn(cls, mid, dataAction, label, likeLikedPath) {
      let svg;
      if (dataAction === "like") {
        svg = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="${likeLikedPath}"></path></svg>`;
      } else {
        const ids = { pin: ICONS.pin, edit: ICONS.edit, trash: ICONS.trash, clock: ICONS.clock, mark: ICONS.mark };
        svg = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="${ids[dataAction] || ""}"></path></svg>`;
      }
      return `<div class="north-luna-moments-action-popup-btn ${cls}" data-mid="${mid}" data-id="${mid}" data-action="${dataAction}">${svg}${label}</div>`;
    }
    function actionsHtml(ctx, it) {
      const mid = esc(it.id);
      const liked = it.liked;
      const likePath = liked ? "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" : "M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z";
      const likeLabel = liked ? "\u53D6\u8D5E" : "\u70B9\u8D5E";
      return `
    <div class="north-luna-moments-item-actions">
      <div class="north-luna-moments-action-bar">
        <button class="north-luna-moments-action-btn like-action${liked ? " liked" : ""}" data-mid="${mid}" data-id="${mid}" data-action="like" title="${likeLabel}" aria-label="${likeLabel}"><svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="${likePath}"></path></svg></button>
        <button class="north-luna-moments-action-btn${it.pinned ? " active" : ""}" data-mid="${mid}" data-id="${mid}" data-action="pin" title="${it.pinned ? "\u53D6\u6D88\u7F6E\u9876" : "\u7F6E\u9876"}" aria-label="${it.pinned ? "\u53D6\u6D88\u7F6E\u9876" : "\u7F6E\u9876"}">${ico("pin", 15)}</button>
        <button class="north-luna-moments-action-btn" data-mid="${mid}" data-id="${mid}" data-action="toggle-comments" title="\u8BC4\u8BBA" aria-label="\u8BC4\u8BBA"><svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M12 3c-5 0-9 3.6-9 8 0 2.5 1.3 4.7 3.4 6.1L5.5 21l4.3-2.3c.7.2 1.4.3 2.2.3 5 0 9-3.6 9-8s-4-8-9-8z"></path></svg></button>
        <button class="north-luna-moments-action-btn" data-mid="${mid}" data-id="${mid}" data-action="edit" title="\u4FEE\u6539" aria-label="\u4FEE\u6539">${ico("edit", 15)}</button>
        <button class="north-luna-moments-action-btn north-luna-moments-action-del" data-mid="${mid}" data-id="${mid}" data-action="del" title="\u5220\u9664" aria-label="\u5220\u9664">${ico("trash", 15)}</button>
        <button class="north-luna-moments-action-btn" data-mid="${mid}" data-id="${mid}" data-action="time" title="\u4FEE\u6539\u65F6\u95F4" aria-label="\u4FEE\u6539\u65F6\u95F4">${ico("clock", 15)}</button>
      </div>
    </div>`;
    }
    function commentsHtml(ctx, it) {
      const mid = esc(it.id);
      const nickname = (ctx.data().config || {}).nickname || "\u6211";
      const list = (it.comments || []).map((c) => {
        const cid = esc(c.id);
        const time = c.time ? `<span class="north-luna-moments-comment-time">${esc(fmtRelative(toTs({ createdAt: c.time && new Date(String(c.time).replace(" ", "T").replace(/-/g, "/")).getTime() })))}</span>` : "";
        return `<div class="north-luna-moments-comment-item" data-cid="${cid}">
        <div class="north-luna-moments-comment-display">
          <span class="north-luna-moments-comment-text"><strong>${esc(c.name || nickname)}\uFF1A</strong>${esc(c.text)}</span>
          <span class="north-luna-moments-comment-actions">
            ${time}
            <span class="north-luna-moments-comment-actions-right">
              <span class="north-luna-moments-comment-del" data-mid="${mid}" data-id="${mid}" data-cid="${cid}" data-action="del-comment" title="\u5220\u9664"><svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg></span>
            </span>
          </span>
        </div>
      </div>`;
      }).join("");
      return `
    <div class="north-luna-moments-comment-panel" data-mid="${mid}">
      ${list}
      <div class="north-luna-moments-comment-input-row" style="display:none">
        <input type="text" class="north-luna-moments-comment-input" data-mid="${mid}" placeholder="\u5199\u8BC4\u8BBA..." maxlength="200">
        <button class="north-luna-moments-comment-send" data-mid="${mid}" data-id="${mid}" data-action="send-comment">\u53D1\u9001</button>
      </div>
    </div>`;
    }
    function isVideoSrc(src) {
      return /\.(mp4|mov|webm|m4v|ogg|ogv)(\?|#|$)/i.test(src) || /^data:video\//i.test(src);
    }
    function mediaHtml(it) {
      const items = (it.images || []).filter(Boolean);
      let html = "";
      if (items.length) {
        const gridClass = items.length === 1 ? "single" : items.length === 2 ? "double" : items.length === 3 ? "triple" : items.length <= 4 ? "four" : "nine";
        const cells = items.map((src, i) => {
          if (isVideoSrc(src)) {
            return `<div class="north-luna-moments-grid-cel north-luna-moments-grid-video" data-action="play-vid" data-src="${esc(src)}" data-idx="${i}" title="\u64AD\u653E\u89C6\u9891"><video class="north-luna-moments-grid-video-el" src="${esc(src)}#t=0.1" data-vthumb="${esc(src)}" muted playsinline preload="metadata"></video><span class="north-luna-moments-grid-play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span></div>`;
          }
          return `<img class="north-luna-moments-grid-img" src="${esc(src)}" data-kind="image" data-action="show-img" data-src="${esc(src)}" data-idx="${i}" alt="media" loading="lazy" decoding="async">`;
        }).join("");
        html += `<div class="north-luna-moments-media"><div class="north-luna-moments-image-grid ${gridClass}">${cells}</div></div>`;
      }
      if (it.link && it.link.title) {
        html += `<div class="north-luna-moments-link-card" data-link-url="${esc(it.link.url || "#")}">
      <div class="north-luna-moments-link-thumb">\u{1F517}</div>
      <div class="north-luna-moments-link-info">
        <div class="north-luna-moments-link-title">${esc(it.link.title)}</div>
        <div class="north-luna-moments-link-url">${esc(it.link.url || "")}</div>
      </div>
    </div>`;
      }
      return html;
    }
    function textHtml(it) {
      const body = renderInlineMd(it.text || "");
      return `<div class="north-luna-moments-item-text">${body || '<span class="north-luna-moments-no-text">[\u65E0\u6587\u5B57]</span>'}</div>`;
    }
    function expandHtml(it) {
      const mid = esc(it.id);
      return `<div class="north-luna-moments-expand" data-mid="${mid}" data-id="${mid}" data-action="expand">
    <span class="moments-expand-text">\u5168\u6587</span>
    <svg class="moments-expand-icon" viewBox="0 0 24 24" fill="currentColor"><path class="moments-expand-arrow" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
  </div>`;
    }
    function cardHeaderHtml(ctx) {
      const cfg = ctx.data().config || {};
      const nickname = cfg.nickname || "\u6708\u4EAE";
      return `<div class="north-luna-moments-item-header">
      ${avatarHtml(cfg.avatar, nickname)}
      <span class="north-luna-moments-item-name">${esc(nickname)}</span>
    </div>`;
    }
    function cardHtml(ctx, it) {
      const pinBadge = it.pinned ? `<div class="north-luna-moments-pin-badge" title="\u5DF2\u7F6E\u9876"><svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="${ICONS.pin}"></path></svg></div>` : "";
      return `
    <div class="north-luna-moments-item" data-mid="${esc(it.id)}" data-id="${esc(it.id)}" data-date="${esc(dateKey(toTs(it)))}">
      ${pinBadge}
      <div class="north-luna-moments-item-content">
        ${cardHeaderHtml(ctx)}
        ${textHtml(it)}
        ${expandHtml(it)}
        ${mediaHtml(it)}
        ${tagsHtml(it)}
        <div class="north-luna-moments-item-meta">
          ${metaTags(it)}
        </div>
        ${actionsHtml(ctx, it)}
        ${commentsHtml(ctx, it)}
      </div>
    </div>`;
    }
    function applyListFolding(listEl, threshold) {
      if (!listEl) return;
      const thr = threshold || 6;
      listEl.querySelectorAll(".north-luna-moments-item").forEach((card) => {
        const textEls = card.querySelectorAll(".north-luna-moments-item-text");
        textEls.forEach((t) => t.classList.remove("moments-folded"));
        card.classList.remove("moments-has-fold", "moments-expanded");
        if (thr <= 0) return;
        let hasFold = false;
        textEls.forEach((textEl) => {
          const cs = getComputedStyle(textEl);
          const lhRaw = parseFloat(cs.lineHeight);
          const fs = parseFloat(cs.fontSize) || 14;
          const lh = !isNaN(lhRaw) && lhRaw >= 1 ? lhRaw : fs * 1.6;
          const lineCount = textEl.scrollHeight / lh;
          if (lineCount > thr) {
            textEl.classList.add("moments-folded");
            textEl.style.setProperty("--moments-fold-lines", String(thr));
            textEl.style.setProperty("--moments-fold-line-h", lh + "px");
            hasFold = true;
          }
        });
        if (hasFold) card.classList.add("moments-has-fold");
      });
    }
    function renderInlineMd(raw) {
      let s = String(raw || "");
      const colorPlaces = [];
      s = s.replace(/<span style="color:([^"]+)">([\s\S]*?)<\/span>/g, (m, c, txt) => {
        colorPlaces.push({ c, txt });
        return "\0COLOR\0";
      });
      s = esc(s);
      s = s.replace(/`([^`\n]+)`/g, '<code class="mom-inline-code">$1</code>');
      s = s.replace(/==([^=\n]+)==/g, '<mark class="mom-mark">$1</mark>');
      s = s.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
      s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
      s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
      s = s.replace(/\u0000COLOR\u0000/g, (m, i) => {
        const p = colorPlaces.shift() || { c: "", txt: "" };
        if (!/^[#\w(),.\s-]+$/.test(p.c)) return p.txt;
        return `<span style="color:${p.c}">${p.txt}</span>`;
      });
      return s;
    }
    module2.exports = { renderApp, renderList, applyFilters, avatarHtml, renderCalendar, renderLockScreen, applyListFolding, hydrateVideoThumbs };
    function renderCalendar(ctx) {
      const el = ctx.listEl;
      if (!el) return;
      const items = ctx.data().items || [];
      const year = ctx.calYear || (/* @__PURE__ */ new Date()).getFullYear();
      const mode = ctx.calMode || "photo";
      const byDay = {};
      items.forEach((it) => {
        const k = dateKey(toTs(it));
        (byDay[k] = byDay[k] || []).push(it);
      });
      const now = /* @__PURE__ */ new Date();
      let monthsHtml = "";
      for (let m = 0; m < 12; m++) {
        const first = new Date(year, m, 1);
        const daysInMonth = new Date(year, m + 1, 0).getDate();
        const lead = first.getDay();
        const wd = ["\u65E5", "\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D"];
        let cells = wd.map((d) => `<div class="mom-cal-dow">${d}</div>`).join("");
        for (let i = 0; i < lead; i++) cells += `<div class="mom-cal-blank"></div>`;
        const maxCnt = Math.max(1, ...Object.values(byDay).map((a) => a.length));
        for (let d = 1; d <= daysInMonth; d++) {
          const key = `${year}-${p2(m + 1)}-${p2(d)}`;
          const list = byDay[key] || [];
          const isToday = now.getFullYear() === year && now.getMonth() === m && now.getDate() === d;
          let inner = "";
          if (list.length) {
            if (mode === "photo") {
              const raw = (list[0].images || []).find(Boolean);
              const cover = raw && isVideoSrc(raw) ? "" : raw;
              const coverVid = raw && isVideoSrc(raw) ? raw : "";
              inner = cover ? `<img src="${esc(cover)}" alt="">` : coverVid ? `<img class="mom-cal-thumb-video" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" data-vthumb="${esc(coverVid)}" alt="">` : `<div class="mom-cal-ph-cnt" style="opacity:${0.4 + Math.min(1, list.length / maxCnt) * 0.6}">${list.length}</div>`;
            } else {
              const op = 0.15 + Math.min(1, list.length / maxCnt) * 0.85;
              inner = `<div class="mom-cal-heatline" style="opacity:${op}">${list.length}</div>`;
            }
          }
          cells += `<button class="mom-cal-cell${isToday ? " is-today" : ""}${list.length ? " has" : ""}" data-action="jump-day" data-date="${key}">${inner}<span class="mom-cal-daynum">${d}</span></button>`;
        }
        monthsHtml += `<section class="mom-cal-month">
      <h4 class="mom-cal-month-t">${m + 1}\u6708</h4>
      <div class="mom-cal-grid">${cells}</div>
    </section>`;
      }
      el.innerHTML = `
    <div class="mom-cal">
      <div class="mom-cal-head">
        <div class="mom-cal-nav">
          <button class="mom-btn mom-btn-small" data-action="cal-year" data-d="-1">\u2039</button>
          <span class="mom-cal-year">${year} \u5E74</span>
          <button class="mom-btn mom-btn-small" data-action="cal-year" data-d="1">\u203A</button>
        </div>
        <div class="mom-cal-modes">
          <button class="mom-btn mom-btn-small${mode === "photo" ? " mom-btn-primary" : ""}" data-action="cal-mode" data-mode="photo">\u7167\u7247</button>
          <button class="mom-btn mom-btn-small${mode === "heatmap" ? " mom-btn-primary" : ""}" data-action="cal-mode" data-mode="heatmap">\u70ED\u5EA6</button>
        </div>
      </div>
      <div class="mom-cal-months">${monthsHtml}</div>
    </div>`;
    }
    function renderLockScreen(container, ctx) {
      const cfg = ctx.data().config || {};
      const now = /* @__PURE__ */ new Date();
      const weekdays = ["\u5468\u65E5", "\u5468\u4E00", "\u5468\u4E8C", "\u5468\u4E09", "\u5468\u56DB", "\u5468\u4E94", "\u5468\u516D"];
      const dateStr2 = `${now.getMonth() + 1}\u6708${now.getDate()}\u65E5 \xB7 ${weekdays[now.getDay()]}`;
      const timeStr = `${p2(now.getHours())}:${p2(now.getMinutes())}`;
      const bg = cfg.lockBg ? ` style="background-image:url(${esc(cfg.lockBg)})"` : "";
      container.innerHTML = `
    <div class="mom-root">
      <div class="mom-lock">
        ${cfg.lockBg ? `<div class="mom-lock-bg"${bg}></div>` : `<div class="mom-lock-bg mom-lock-bg--glass"></div>`}
        <div class="mom-lock-panel">
          <div class="mom-lock-top">
            <div class="mom-lock-date">${dateStr2}</div>
            <div class="mom-lock-time" data-locktime>${timeStr}</div>
          </div>
          <div class="mom-lock-bottom">
            <div class="mom-avatar mom-avatar-ph mom-lock-avatar">${esc((cfg.nickname || "\u6708").slice(0, 1))}</div>
            <div class="mom-lock-name">${esc(cfg.nickname)}</div>
            <input type="password" class="mom-lock-input" data-lockpass placeholder="\u8BF7\u8F93\u5165\u5BC6\u7801" maxlength="20">
            <div class="mom-lock-error" data-lockerr hidden>\u5BC6\u7801\u9519\u8BEF</div>
            <button class="mom-btn mom-btn-primary" data-action="unlock">\u89E3\u9501</button>
            <div class="mom-lock-hint">\u8F93\u5165\u5BC6\u7801\u89E3\u9501\u65E5\u8BB0\u6D41</div>
          </div>
        </div>
      </div>
    </div>`;
      ctx.container = container;
      const tEl = container.querySelector("[data-locktime]");
      if (tEl) {
        clearInterval(ctx.__clockTimer);
        ctx.__clockTimer = setInterval(() => {
          const n = /* @__PURE__ */ new Date();
          tEl.textContent = `${p2(n.getHours())}:${p2(n.getMinutes())}`;
        }, 1e3);
      }
    }
  }
});


// src/export.js
var require_export = __commonJS({
  "src/export.js"(exports2, module2) {
    var { esc, toTs, fmtDisplay } = require_util();
    function collect(ctx) {
      return (ctx.data().items || []).slice().sort((a, b) => toTs(b) - toTs(a));
    }
    function download(name, content, mime) {
      const blob = content instanceof Blob ? content : new Blob([content], { type: mime || "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 500);
    }
    function metaLine(it) {
      const parts = [];
      if (it.location) parts.push(it.location);
      return parts.join(" \xB7 ");
    }
    async function exportMd(ctx) {
      const items = collect(ctx);
      const cfg = ctx.data().config || {};
      const lines = [`# \u65E5\u8BB0\u6D41 \xB7 ${cfg.nickname || ""}
`, `\u5171 ${items.length} \u6761
`];
      for (const it of items) {
        lines.push(`
## ${fmtDisplay(it.created || "")}${it.pinned ? " [\u7F6E\u9876]" : ""}${it.liked ? " [\u8D5E]" : ""}`);
        const meta = metaLine(it);
        if (meta) lines.push(meta);
        if (it.text) lines.push(it.text);
        for (let __i = 0; __i < (it.images || []).length; __i++) {
          const __ref = it.images[__i];
          const src = await (globalThis.__DF_ASSETS ? globalThis.__DF_ASSETS.toDataUrl(__ref) : Promise.resolve(__ref));
          lines.push(`
![\u56FE${__i + 1}](${src})`);
        }
        if (it.link) lines.push(`\u94FE\u63A5\uFF1A${it.link}`);
        if (it.comments && it.comments.length) {
          it.comments.forEach((c) => lines.push(`> ${c.name || "\u6211"}: ${c.text}`));
        }
      }
      download(`\u65E5\u8BB0\u6D41_${Date.now()}.md`, lines.join("\n"));
      return true;
    }
    async function exportWord(ctx) {
      const items = collect(ctx);
      const cfg = ctx.data().config || {};
      const bodyArr = [];
      for (const it of items) {
        const meta = metaLine(it);
        let imgs = "";
        for (const __ref of (it.images || [])) {
          const src = await (globalThis.__DF_ASSETS ? globalThis.__DF_ASSETS.toDataUrl(__ref) : Promise.resolve(__ref));
          imgs += `<div style="margin:6px 0"><img src="${src}" style="max-width:100%"></div>`;
        }
        bodyArr.push(`<div style="margin:0 0 18px">
        <div style="color:#666">${esc(fmtDisplay(it.created || ""))}</div>
        ${meta ? `<div style="color:#888">${esc(meta)}</div>` : ""}
        <div style="white-space:pre-wrap">${esc(it.text || "")}</div>
        ${imgs}
        ${it.link ? `<div style="color:#1662af"><a href="${esc(it.link)}">${esc(it.link)}</a></div>` : ""}
        ${it.comments && it.comments.length ? `<div style="background:#f2f2f2;padding:6px 8px;margin-top:6px">${it.comments.map((c) => `${esc(c.name || "\u6211")}\uFF1A${esc(c.text)}`).join("<br>")}</div>` : ""}
      </div>`);
      }
      const body = bodyArr.join("\n");
      download(
        `\u65E5\u8BB0\u6D41_${Date.now()}.doc`,
        `<html><head><meta charset="utf-8"></head><body><h1>${esc(cfg.nickname || "\u65E5\u8BB0\u6D41")}</h1>${body}</body></html>`,
        "application/msword;charset=utf-8"
      );
      return true;
    }
    async function exportJson(ctx) {
      download(`\u65E5\u8BB0\u6D41_${Date.now()}.json`, JSON.stringify(ctx.data(), null, 2), "application/json;charset=utf-8");
      return true;
    }
    async function exportAll(ctx, kind) {
      switch (kind) {
        case "md":
          return exportMd(ctx);
        case "word":
          return exportWord(ctx);
        case "json":
          return exportJson(ctx);
        default:
          throw new Error("\u672A\u77E5\u5BFC\u51FA\u7C7B\u578B");
      }
    }
    module2.exports = { export: exportAll, exportMd, exportWord, exportJson, download };
  }
});


// src/editor.js
var require_editor = __commonJS({
  "src/editor.js"(exports2, module2) {
    var { esc, genId, fmtDisplay, toTs, p2, fmtRelative } = require_util();
    var exp = require_export();
    var render2 = require_render();
    function fmtCmtTime(t) {
      if (!t) return "";
      const d = new Date(String(t).replace(" ", "T").replace(/-/g, "/"));
      return isNaN(d.getTime()) ? esc(String(t)) : fmtRelative(d.getTime());
    }
    function find(ctx, id) {
      return (ctx.data().items || []).find((i) => String(i.id) === String(id));
    }
    function register(ctx, container) {
      const c = container || ctx.container;
      c.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-action], [data-act]");
        if (!btn || !c.contains(btn)) return;
        handle(ctx, btn.getAttribute("data-action") || btn.getAttribute("data-act"), btn);
      });
      c.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        const inp = e.target.closest("[data-lockpass]");
        if (inp && c.contains(inp)) {
          e.preventDefault();
          tryUnlock(ctx, inp);
        }
      });
    }
    function handle(ctx, action, btn) {
      switch (action) {
        case "open-editor":
          openEditor(ctx);
          break;
        case "open-settings":
          openSettings(ctx);
          break;
        // 签名工具条：封面管理（上传 / 从资源库 / 删除）+ 记忆日历视图
        case "upload":
          uploadCover(ctx);
          break;
        case "resource":
          openResourcePicker(ctx);
          break;
        case "calendar": {
          openCalendarModal(ctx);
          break;
        }
        case "delete":
          deleteCover(ctx);
          break;
        case "search-tag": {
          const t = btn.getAttribute("data-tag");
          if (t) {
            ctx.filters.kw = "#" + t;
            ctx.showMessage && ctx.showMessage("已按标签过滤 #" + t);
            ctx.reApp();
          }
          break;
        }
        case "like": {
          const it = find(ctx, btn.dataset.id);
          if (!it) break;
          it.liked = !it.liked;
          ctx.save().then(() => ctx.reApp());
          break;
        }
        case "more": {
          const pop = btn.parentElement && btn.parentElement.querySelector(".north-luna-moments-action-popup");
          const listEl = btn.closest(".north-luna-moments-list") || ctx.container;
          listEl.querySelectorAll(".north-luna-moments-action-popup").forEach((p) => p.style.display = "none");
          listEl.querySelectorAll(".north-luna-moments-item.popup-open").forEach((c) => c.classList.remove("popup-open"));
          if (pop) {
            const wasVisible = pop.style.display === "flex";
            if (!wasVisible) {
              pop.style.display = "flex";
              const card = btn.closest(".north-luna-moments-item");
              if (card) card.classList.add("popup-open");
            }
          }
          break;
        }
        case "pin": {
          const it = find(ctx, btn.dataset.id);
          if (!it) break;
          it.pinned = !it.pinned;
          ctx.save().then(() => ctx.reApp());
          break;
        }
        case "del": {
          const id = btn.dataset.id;
          const it = find(ctx, id);
          if (!it) break;
          void showConfirm(ctx, `\u5220\u9664\u8FD9\u6761\u52A8\u6001\uFF1F\n${(it.text || "").slice(0, 40)}`, { danger: true, ok: "\u5220\u9664" }).then((ok) => {
            if (!ok) return;
            ctx.data().items = (ctx.data().items || []).filter((i) => String(i.id) !== String(id));
            ctx.save().then(() => ctx.reApp());
          });
          break;
        }
        case "edit": {
          const it = find(ctx, btn.dataset.id);
          if (it) openEditor(ctx, it);
          break;
        }
        case "time": {
          const it = find(ctx, btn.dataset.id);
          if (it) changeTime(ctx, it);
          break;
        }
        case "toggle-comments": {
          const itm = btn.closest(".north-luna-moments-item");
          ctx.container.querySelectorAll(".north-luna-moments-comment-input-row").forEach((r) => r.style.display = "none");
          ctx.container.querySelectorAll(".north-luna-moments-item.popup-open").forEach((c) => c.classList.remove("popup-open"));
          const panel = itm && itm.querySelector(".north-luna-moments-comment-panel");
          const inputRow2 = panel && panel.querySelector(".north-luna-moments-comment-input-row");
          if (itm) {
            const pop = itm.querySelector(".north-luna-moments-action-popup");
            if (pop) pop.style.display = "none";
          }
          if (inputRow2) {
            const wasOpen = inputRow2.style.display !== "none";
            inputRow2.style.display = wasOpen ? "none" : "flex";
            if (!wasOpen) {
              const input = inputRow2.querySelector(".north-luna-moments-comment-input");
              if (input) setTimeout(() => input.focus(), 100);
            }
          }
          break;
        }
        case "send-comment": {
          const id = btn.dataset.id;
          const it = find(ctx, id);
          if (!it) break;
          const panel = btn.closest(".north-luna-moments-comment-panel");
          const input = panel && panel.querySelector(".north-luna-moments-comment-input");
          const text = (input && input.value || "").trim();
          if (!text) break;
          it.comments = it.comments || [];
          const now = /* @__PURE__ */ new Date();
          const p2s = (n) => String(n).padStart(2, "0");
          const time = `${now.getFullYear()}-${p2s(now.getMonth() + 1)}-${p2s(now.getDate())} ${p2s(now.getHours())}:${p2s(now.getMinutes())}:${p2s(now.getSeconds())}`;
          const c = { id: genId(), name: (ctx.data().config || {}).nickname || "\u6211", text, time };
          it.comments.push(c);
          input.value = "";
          ctx.save();
          const item = document.createElement("div");
          item.className = "north-luna-moments-comment-item";
          item.dataset.cid = c.id;
          const ctime = esc(fmtCmtTime(c.time));
          item.innerHTML = `<div class="north-luna-moments-comment-display"><span class="north-luna-moments-comment-text"><strong>${esc(c.name)}\uFF1A</strong>${esc(c.text)}</span><span class="north-luna-moments-comment-actions"><span class="north-luna-moments-comment-time">${ctime}</span><span class="north-luna-moments-comment-actions-right"><span class="north-luna-moments-comment-del" data-mid="${esc(it.id)}" data-id="${esc(it.id)}" data-cid="${esc(c.id)}" data-action="del-comment" title="\u5220\u9664"><svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg></span></span></span></div>`;
          if (panel) panel.insertBefore(item, panel.querySelector(".north-luna-moments-comment-input-row"));
          if (inputRow2) inputRow2.style.display = "none";
          break;
        }
        case "del-comment": {
          const id = btn.dataset.id;
          const it = find(ctx, id);
          if (!it) break;
          void showConfirm(ctx, "\u5220\u9664\u8FD9\u6761\u8BC4\u8BBA\uFF1F", { danger: true, ok: "\u5220\u9664" }).then((ok) => {
            if (!ok) return;
            it.comments = (it.comments || []).filter((c) => String(c.id) !== String(btn.dataset.cid));
            ctx.save();
            const ci = btn.closest(".north-luna-moments-comment-item");
            if (ci) ci.remove();
          });
          break;
        }
        case "expand": {
          const card = btn.closest(".north-luna-moments-item");
          if (!card) break;
          const expanded = card.classList.toggle("moments-expanded");
          const textEl = btn.querySelector(".moments-expand-text");
          const arrowEl = btn.querySelector(".moments-expand-arrow");
          if (textEl) textEl.textContent = expanded ? "\u6536\u8D77" : "\u5168\u6587";
          if (arrowEl) arrowEl.setAttribute("d", expanded ? "M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z" : "M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z");
          break;
        }
        case "show-img": {
          const card = btn.closest(".north-luna-moments-item");
          const it = find(ctx, card && card.dataset.id);
          if (!it) break;
          showLightbox(ctx, (it.images || []).filter(Boolean), Number(btn.dataset.idx) || 0);
          break;
        }
        case "play-vid":
          showVideoLightbox(ctx, btn.dataset.src);
          break;
        case "switch-view":
          ctx.view = btn.dataset.view || "feed";
          ctx.reApp();
          break;
        case "open-outline":
          openMonthOutline(ctx, btn);
          break;
        case "cal-year":
          ctx.calYear = (ctx.calYear || (/* @__PURE__ */ new Date()).getFullYear()) + (Number(btn.dataset.d) || 0);
          ctx.reApp();
          break;
        case "cal-mode":
          ctx.calMode = btn.dataset.mode || "photo";
          ctx.reApp();
          break;
        case "jump-day":
          jumpToDate(ctx, btn.dataset.date);
          break;
        case "jump-mid":
          jumpToItem(ctx, btn.dataset.id);
          break;
        case "unlock":
          tryUnlock(ctx, btn);
          break;
      }
    }
    function tryUnlock(ctx, btn) {
      const root = btn && btn.closest(".mom-lock") || ctx.container;
      const input = root.querySelector("[data-lockpass]");
      const err = root.querySelector("[data-lockerr]");
      const cfg = ctx.data().config || {};
      const val = (input && input.value || "").trim();
      const pass = (cfg.lockPasscode || "").trim();
      if (pass && val === pass) {
        ctx.__unlocked = true;
        ctx.reApp();
      } else {
        if (err) err.hidden = false;
        if (root) {
          root.classList.remove("shake");
          void root.offsetWidth;
          root.classList.add("shake");
        }
        if (input) {
          input.value = "";
          input.focus();
        }
      }
    }
    function openMonthOutline(ctx, btn) {
      const container = ctx.container;
      const scrollEl = ctx.scrollEl || container;
      if (!container || !ctx.listEl) return;
      const groups = Array.from(ctx.listEl.querySelectorAll(".north-luna-moments-date-group"));
      if (!groups.length) {
        if (ctx.showMessage) ctx.showMessage("\u6682\u65E0\u6708\u4EFD\u5206\u7EC4");
        return;
      }
      const existing = container.querySelector(".north-luna-moments-outline-popover");
      if (existing) {
        closeOutline(ctx, existing);
        return;
      }
      const pop = document.createElement("div");
      pop.className = "north-luna-moments-outline-popover";
      pop.innerHTML = '<div class="north-luna-moments-outline-title">\u6708\u4EFD\u5927\u7EB2</div>' + groups.map((g, i) => {
        const t = g.querySelector(".north-luna-moments-date-group-text");
        return `<div class="north-luna-moments-outline-item" data-idx="${i}">${esc(t ? (t.textContent || "").trim() : "")}</div>`;
      }).join("");
      const fabRect = btn && btn.getBoundingClientRect() || { left: 0, bottom: 0 };
      pop.style.position = "fixed";
      pop.style.right = window.innerWidth - fabRect.left + 8 + "px";
      pop.style.bottom = Math.max(12, window.innerHeight - fabRect.bottom) + "px";
      container.appendChild(pop);
      pop.querySelectorAll(".north-luna-moments-outline-item").forEach((item) => {
        item.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const g = groups[parseInt(item.dataset.idx, 10)];
          if (g) {
            const top = g.offsetTop - 50;
            scrollEl.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
          }
          closeOutline(ctx, pop);
        });
      });
      updateActiveMonth(ctx, groups);
      const onScroll = () => {
        if (container.querySelector(".north-luna-moments-outline-popover")) updateActiveMonth(ctx, groups);
      };
      scrollEl.addEventListener("scroll", onScroll, { passive: true });
      pop.__cleanup = () => scrollEl.removeEventListener("scroll", onScroll);
      const close = (ev) => {
        if (pop && !pop.contains(ev.target) && ev.target !== btn) closeOutline(ctx, pop);
      };
      ctx.__outlineClose = close;
      setTimeout(() => document.addEventListener("click", close), 0);
    }
    function updateActiveMonth(ctx, groups) {
      const container = ctx.container;
      const scrollEl = ctx.scrollEl || container;
      const items = container.querySelectorAll(".north-luna-moments-outline-item");
      const rootRect = scrollEl.getBoundingClientRect();
      let activeIdx = 0;
      for (let i = 0; i < groups.length; i++) {
        const rect = groups[i].getBoundingClientRect();
        if (rect.top - rootRect.top < 80) activeIdx = i;
      }
      items.forEach((it, idx) => it.classList.toggle("active", idx === activeIdx));
    }
    function closeOutline(ctx, pop) {
      if (pop) {
        if (pop.__cleanup) pop.__cleanup();
        pop.remove();
      }
      if (ctx.__outlineClose) {
        document.removeEventListener("click", ctx.__outlineClose);
        ctx.__outlineClose = null;
      }
    }
    function jumpToDate(ctx, dateStr) {
      ctx.view = "feed";
      ctx.reApp();
      setTimeout(() => {
        const selector = dateStr && dateStr.length <= 7 ? `.north-luna-moments-item[data-date^="${dateStr}"]` : `.north-luna-moments-item[data-date="${dateStr}"]`;
        const target = (ctx.mounts || []).map((c) => c.querySelector && c.querySelector(selector)).find(Boolean);
        if (target) {
          scrollToItem(target);
        } else {
          ctx.showMessage("\u8BE5\u65E5\u671F\u6682\u65E0\u52A8\u6001");
        }
      }, 60);
    }
    function jumpToItem(ctx, id) {
      ctx.view = "feed";
      ctx.reApp();
      setTimeout(() => {
        const target = (ctx.mounts || []).map((c) => c.querySelector && c.querySelector(`.north-luna-moments-item[data-id="${id}"]`)).find(Boolean);
        if (target) scrollToItem(target);
        else ctx.showMessage("\u627E\u4E0D\u5230\u8BE5\u52A8\u6001");
      }, 60);
    }
    function scrollToItem(target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      target.classList.add("mom-flash");
      setTimeout(() => target.classList.remove("mom-flash"), 1600);
    }
    // ===== 日历弹窗（复刻 siyuan-moments _openCoverCalendar）=====
    function isRealImage(url) {
      return !/\.(mp4|webm|mkv|mov|wmv|flv|mp3|wav|aac|ogg|m4a|pdf|pptx?|docx?|xlsx?|zip|rar)$/i.test(url.split("?")[0]);
    }
    function calGridStats(ctx, year) {
      const dayCounts = {};
      const dayAllImgs = {};
      (ctx.data().items || []).forEach((it) => {
        const d = new Date(toTs(it));
        if (d.getFullYear() === year) {
          const key = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
          dayCounts[key] = (dayCounts[key] || 0) + 1;
          (it.images || []).forEach((img) => {
            if (img && img.trim && isRealImage(img) && !(dayAllImgs[key] || []).includes(img)) {
              (dayAllImgs[key] = dayAllImgs[key] || []).push(img);
            }
          });
        }
      });
      const dayFirstImg = {};
      Object.keys(dayAllImgs).forEach((key) => {
        const imgs = dayAllImgs[key];
        if (imgs.length === 1) { dayFirstImg[key] = imgs[0]; return; }
        let hash = 0;
        for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
        dayFirstImg[key] = imgs[Math.abs(hash) % imgs.length];
      });
      return { dayCounts, dayFirstImg };
    }
    function calStartDate(year) {
      const y0 = new Date(year, 0, 1);
      const s = new Date(y0);
      s.setDate(y0.getDate() - (y0.getDay() + 6) % 7);
      return s;
    }
    function calWeeks(year, startDate) {
      const yEnd = new Date(year, 11, 31);
      const total = Math.floor((yEnd - startDate) / 864e5) + 1;
      return Math.ceil(total / 7);
    }
    // 图片封面模式：单栏 + 全年 12 个月 7 天一周
    function calBuildPhoto(ctx, year) {
      const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
      const { dayCounts, dayFirstImg } = calGridStats(ctx, year);
      const startDate = calStartDate(year);
      const weeks = calWeeks(year, startDate);
      const monthWeeks = new Array(12).fill(null).map(() => []);
      for (let w = 0; w < weeks; w++) {
        const monthSet = new Set();
        for (let d = 0; d < 7; d++) {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + w * 7 + d);
          if (date.getFullYear() === year) monthSet.add(date.getMonth());
        }
        monthSet.forEach((m2) => monthWeeks[m2].push(w));
      }
      const renderMonth = (m2) => {
        let grid = "";
        monthWeeks[m2].forEach((w) => {
          let rowCells = "";
          for (let d = 0; d < 7; d++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + w * 7 + d);
            if (date.getFullYear() === year && date.getMonth() === m2) {
              const key = `${date.getFullYear()}-${p2(date.getMonth() + 1)}-${p2(date.getDate())}`;
              const count = dayCounts[key] || 0;
              const tip = count > 0 ? `${m2 + 1}月${date.getDate()}日: ${count}条` : `${m2 + 1}月${date.getDate()}日`;
              const dateAttr = count > 0 ? ` data-date="${key}"` : "";
              const num = `<span class="mom-calendar-photo-num">${date.getDate()}</span>`;
              if (count > 0 && dayFirstImg[key]) {
                rowCells += `<div class="mom-calendar-photo-cell has-photo"${dateAttr} title="${tip}">${num}<img class="mom-calendar-photo-img" src="${esc(dayFirstImg[key])}" alt="" loading="lazy"></div>`;
              } else if (count > 0) {
                rowCells += `<div class="mom-calendar-photo-cell has-record"${dateAttr} title="${tip}">${num}<span class="mom-calendar-photo-dot"></span></div>`;
              } else {
                rowCells += `<div class="mom-calendar-photo-cell" title="${tip}">${num}</div>`;
              }
            } else {
              rowCells += `<div class="mom-calendar-photo-cell empty"></div>`;
            }
          }
          grid += `<div class="mom-calendar-photo-row">${rowCells}</div>`;
        });
        return `<div class="mom-calendar-photo-month"><div class="mom-calendar-photo-month-title">${year}年${monthNames[m2]}</div><div class="mom-calendar-photo-grid">${grid}</div></div>`;
      };
      return `<div class="mom-calendar-photo-twocol">${Array.from({ length: 12 }, (_, i) => renderMonth(i)).join("")}</div>`;
    }
    // 热力图模式：53 列周视图
    function calBuildHeat(ctx, year) {
      const { dayCounts } = calGridStats(ctx, year);
      const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
      const startDate = calStartDate(year);
      const weeks = calWeeks(year, startDate);
      let columns = "";
      for (let w = 0; w < weeks; w++) {
        let cells = "";
        for (let d = 0; d < 7; d++) {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + w * 7 + d);
          if (date.getFullYear() === year) {
            const key = `${date.getFullYear()}-${p2(date.getMonth() + 1)}-${p2(date.getDate())}`;
            const count = dayCounts[key] || 0;
            let level = 0;
            if (count >= 1) level = 2;
            if (count >= 3) level = 3;
            if (count >= 5) level = 4;
            const tip = count > 0 ? `${date.getMonth() + 1}月${date.getDate()}日: ${count}条` : `${date.getMonth() + 1}月${date.getDate()}日`;
            const dateAttr = count > 0 ? ` data-date="${key}"` : "";
            cells += `<div class="mom-calendar-cell level-${level}"${dateAttr} title="${tip}"></div>`;
          } else {
            cells += `<div class="mom-calendar-cell level-empty"></div>`;
          }
        }
        columns += `<div class="mom-calendar-column">${cells}</div>`;
      }
      const msW = new Array(12).fill(-1);
      const meW = new Array(12).fill(-1);
      for (let w = 0; w < weeks; w++) {
        for (let d = 0; d < 7; d++) {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + w * 7 + d);
          if (date.getFullYear() === year) {
            const m2 = date.getMonth();
            if (msW[m2] === -1) msW[m2] = w;
            meW[m2] = w;
          }
        }
      }
      const labels = [];
      for (let m2 = 0; m2 < 12; m2++) {
        if (msW[m2] !== -1) {
          const mid = (msW[m2] + meW[m2]) / 2;
          labels.push(`<span class="mom-calendar-month-label" style="left:${(mid + 0.5) / weeks * 100}%">${monthNames[m2]}</span>`);
        }
      }
      return `<div class="mom-calendar-columns">${columns}</div><div class="mom-calendar-months">${labels.join("")}</div>`;
    }
    function openCalendarModal(ctx) {
      ctx.calMode = ctx.calMode || "photo";
      if (!ctx.calYear) ctx.calYear = (/* @__PURE__ */ new Date()).getFullYear();
      const items = ctx.data().items || [];
      const years = new Set();
      items.forEach((it) => years.add(new Date(toTs(it)).getFullYear()));
      years.add((/* @__PURE__ */ new Date()).getFullYear());
      const sortedYears = Array.from(years).sort((a, b) => b - a);
      const overlay = overlayBase("mom-calendar");
      overlay.innerHTML = `
    <div class="mom-calendar-modal">
      <div class="mom-calendar-overlay" data-cal-close></div>
      <div class="mom-calendar-content">
        <div class="mom-calendar-header">
          <div class="mom-calendar-title">
            <span>日历</span>
            <select class="mom-calendar-year" data-cal-year></select>
            <span class="mom-calendar-modes">
              <button class="mom-calendar-mode${ctx.calMode === "photo" ? " on" : ""}" data-cal-mode="photo">照片</button>
              <button class="mom-calendar-mode${ctx.calMode === "heatmap" ? " on" : ""}" data-cal-mode="heatmap">热度</button>
            </span>
            <span class="mom-calendar-count" data-cal-count></span>
          </div>
          <div class="mom-calendar-close" data-cal-close>×</div>
        </div>
        <div class="mom-calendar-body" data-cal-body></div>
      </div>
    </div>`;
      document.body.appendChild(overlay);
      const content = overlay.querySelector(".mom-calendar-content");
      const body = overlay.querySelector("[data-cal-body]");
      const countEl = overlay.querySelector("[data-cal-count]");
      const modeBtns = overlay.querySelectorAll("[data-cal-mode]");
      const yearSel = overlay.querySelector("[data-cal-year]");
      yearSel.innerHTML = sortedYears.map((y) => `<option value="${y}"${y === ctx.calYear ? " selected" : ""}>${y}年</option>`).join("");
      const applyWidth = (mode) => {
        content.style.maxWidth = mode === "photo" ? "420px" : "1200px";
        content.style.width = mode === "photo" ? "auto" : "94%";
      };
      const scrollCurMonth = () => {
        if (ctx.calMode !== "photo") return;
        const now = /* @__PURE__ */ new Date();
        const targetTitle = `${now.getFullYear()}年${now.getMonth() + 1}月`;
        setTimeout(() => {
          body.querySelectorAll(".mom-calendar-photo-month-title").forEach((t) => {
            if (t.textContent.trim() === targetTitle) { t.scrollIntoView({ behavior: "auto", block: "start" }); body.scrollTop -= 12; }
          });
        }, 0);
      };
      const renderBody = () => {
        const year = Number(yearSel.value) || ctx.calYear;
        ctx.calYear = year;
        body.innerHTML = ctx.calMode === "heatmap" ? calBuildHeat(ctx, year) : calBuildPhoto(ctx, year);
        countEl.textContent = items.filter((it) => new Date(toTs(it)).getFullYear() === year).length + " 条记录";
        modeBtns.forEach((b) => b.classList.toggle("on", b.dataset.calMode === ctx.calMode));
        applyWidth(ctx.calMode);
        scrollCurMonth();
      };
      renderBody();
      overlay.addEventListener("click", (e) => {
        if (e.target.closest("[data-cal-close]")) { overlay.remove(); return; }
        const modeBtn = e.target.closest("[data-cal-mode]");
        if (modeBtn) { ctx.calMode = modeBtn.dataset.calMode; renderBody(); return; }
        const cell = e.target.closest("[data-date]");
        if (cell) {
          overlay.remove();
          jumpToDate(ctx, cell.getAttribute("data-date"));
        }
      });
      yearSel.addEventListener("change", renderBody);
      // 拖动（仅 header 区域）
      const header = overlay.querySelector(".mom-calendar-header");
      let isDragging = false, startX = 0, startY = 0, originLeft = 0, originTop = 0;
      header.addEventListener("mousedown", (e) => {
        if (e.target.closest("[data-cal-close]") || e.target.closest("[data-cal-year]") || e.target.closest("[data-cal-mode]")) return;
        isDragging = true;
        const rect = content.getBoundingClientRect();
        content.style.position = "absolute";
        content.style.margin = "0";
        content.style.left = rect.left + "px";
        content.style.top = rect.top + "px";
        content.classList.add("dragging");
        startX = e.clientX; startY = e.clientY;
        originLeft = rect.left; originTop = rect.top;
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
        e.preventDefault();
      });
      const onMove = (e) => {
        if (!isDragging) return;
        let x = originLeft + (e.clientX - startX);
        let y = originTop + (e.clientY - startY);
        x = Math.max(0, Math.min(x, window.innerWidth - content.offsetWidth));
        y = Math.max(0, Math.min(y, window.innerHeight - content.offsetHeight));
        content.style.left = x + "px";
        content.style.top = y + "px";
      };
      const endDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        content.classList.remove("dragging");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", endDrag);
      document.addEventListener("mouseleave", endDrag);
      overlay.remove = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", endDrag);
        document.removeEventListener("mouseleave", endDrag);
        HTMLElement.prototype.remove.call(overlay);
      };
    }
    function showConfirm(ctx, message, options) {
      const opts = options || {};
      return new Promise((resolve) => {
        const overlay = overlayBase("mom-confirm");
        overlay.innerHTML = `
    <div class="mom-modal mom-modal-sm">
      <div class="mom-modal-head"><span>${esc(opts.title || "\u786E\u8BA4")}</span><button class="mom-modal-x" data-x type="button">\u2715</button></div>
      <div class="mom-modal-body"><p class="mom-confirm-msg">${esc(message).replace(/\n/g, "<br>")}</p></div>
      <div class="mom-modal-foot">
        <button class="mom-btn" data-cancel type="button">${esc(opts.cancel || "\u53D6\u6D88")}</button>
        <button class="mom-btn${opts.danger ? " mom-btn-danger" : " mom-btn-primary"}" data-ok type="button">${esc(opts.ok || "\u786E\u5B9A")}</button>
      </div>
    </div>`;
        document.body.appendChild(overlay);
        const done = (v) => {
          overlay.remove();
          resolve(v);
        };
        overlay.addEventListener("click", (e) => {
          if (e.target.closest("[data-x]") || e.target.closest("[data-cancel]") || e.target === overlay) done(false);
          if (e.target.closest("[data-ok]")) done(true);
        });
      });
    }
    function showLightbox(ctx, images, startIdx) {
      const list = (images || []).filter((src) => src && !editorIsVideoSrc(src));
      if (!list.length) return;
      const lb = ctx.lightbox;
      if (!lb) return;
      let idx = Math.max(0, Math.min(Number(startIdx) || 0, list.length - 1));
      let onKey = null;
      const close = () => {
        lb.hidden = true;
        lb.innerHTML = "";
        if (onKey) document.removeEventListener("keydown", onKey);
        onKey = null;
      };
      const renderLb = () => {
        const multi = list.length > 1;
        lb.innerHTML = `
      <button class="mom-lightbox-close" data-lb-close type="button" aria-label="\u5173\u95ED">\u2715</button>
      ${multi ? `<button class="mom-lightbox-nav mom-lightbox-prev" data-lb-prev type="button" aria-label="\u4E0A\u4E00\u5F20"${idx <= 0 ? " disabled" : ""}>\u2039</button>` : ""}
      <img class="mom-lightbox-img" src="${esc(list[idx])}" alt="">
      ${multi ? `<button class="mom-lightbox-nav mom-lightbox-next" data-lb-next type="button" aria-label="\u4E0B\u4E00\u5F20"${idx >= list.length - 1 ? " disabled" : ""}>\u203A</button>` : ""}
      ${multi ? `<div class="mom-lightbox-dots">${list.map((_, i) => `<button type="button" class="mom-lightbox-dot${i === idx ? " active" : ""}" data-lb-dot="${i}" aria-label="\u7B2C ${i + 1} \u5F20"></button>`).join("")}</div>` : ""}
      ${multi ? `<div class="mom-lightbox-counter">${idx + 1} / ${list.length}</div>` : ""}`;
        lb.querySelector("[data-lb-close]")?.addEventListener("click", (e) => {
          e.stopPropagation();
          close();
        });
        lb.querySelector("[data-lb-prev]")?.addEventListener("click", (e) => {
          e.stopPropagation();
          if (idx > 0) {
            idx--;
            renderLb();
          }
        });
        lb.querySelector("[data-lb-next]")?.addEventListener("click", (e) => {
          e.stopPropagation();
          if (idx < list.length - 1) {
            idx++;
            renderLb();
          }
        });
        lb.querySelectorAll("[data-lb-dot]").forEach((dot) => {
          dot.addEventListener("click", (e) => {
            e.stopPropagation();
            idx = Number(dot.dataset.lbDot) || 0;
            renderLb();
          });
        });
        const img = lb.querySelector(".mom-lightbox-img");
        if (img) img.addEventListener("click", (e) => e.stopPropagation());
      };
      onKey = (e) => {
        if (e.key === "Escape") close();
        if (e.key === "ArrowLeft" && idx > 0) {
          idx--;
          renderLb();
        }
        if (e.key === "ArrowRight" && idx < list.length - 1) {
          idx++;
          renderLb();
        }
      };
      lb.onclick = (e) => {
        if (e.target === lb) close();
      };
      lb.hidden = false;
      renderLb();
      document.addEventListener("keydown", onKey);
    }
    function showVideoLightbox(ctx, src) {
      const lb = ctx.lightbox;
      if (!lb) return;
      lb.innerHTML = "";
      const video = document.createElement("video");
      video.src = globalThis.__DF_ASSETS ? globalThis.__DF_ASSETS.resolve(src) : src;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.style.maxWidth = "92vw";
      video.style.maxHeight = "80vh";
      lb.appendChild(video);
      lb.hidden = false;
      const close = () => {
        video.pause();
        lb.hidden = true;
        lb.innerHTML = "";
      };
      lb.addEventListener("click", close);
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") close();
      }, { once: true });
    }
    const ASSET_PREFIX = "dfasset://media/";
    function compressImage(file, maxDim, quality) {
      maxDim = maxDim || 1920;
      quality = quality || 0.85;
      return new Promise((resolve) => {
        if (!file.type || !file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
          resolve(file);
          return;
        }
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          let w = img.width;
          let h = img.height;
          const scale = Math.min(1, maxDim / Math.max(w, h, 1));
          w = Math.max(1, Math.round(w * scale));
          h = Math.max(1, Math.round(h * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
          canvas.toBlob((blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const ext = outType === "image/png" ? "png" : "jpg";
            resolve(new File([blob], (file.name || "image").replace(/\.[^.]+$/, "") + "." + ext, { type: outType }));
          }, outType, quality);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(file);
        };
        img.src = url;
      });
    }
    async function uploadDiaryflowFile(file) {
      const ext = (file.name && file.name.match(/\.([a-z0-9]+)$/i) || [, "bin"])[1].toLowerCase();
      const name = `df_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      try {
        return await globalThis.__DF_ASSETS.save(file, name);
      } catch (e) {
        console.error("[orca-diaryflow] asset save failed", e);
      }
      return null;
    }
    async function saveImageToAssets(file) {
      const compressed = await compressImage(file);
      const uploaded = await uploadDiaryflowFile(compressed);
      if (uploaded) return uploaded;
      return readAsDataURL(file);
    }
    async function uploadAsset(file) {
      return saveImageToAssets(file);
    }
    function applyCoverDom(container, url) {
      if (!container) return;
      const coverBg = container.querySelector(".mom-cover-bg");
      if (!coverBg) return;
      let img = coverBg.querySelector(".mom-cover-img");
      if (url) {
        if (!img) {
          img = document.createElement("img");
          img.className = "mom-cover-img";
          img.setAttribute("data-cover-img", "");
          img.alt = "cover";
          coverBg.insertBefore(img, coverBg.firstChild);
          const def = coverBg.querySelector(".mom-cover-default");
          if (def) def.remove();
        }
        img.src = url;
        img.style.display = "";
      } else {
        if (img) img.remove();
        let def = coverBg.querySelector(".mom-cover-default");
        if (!def) {
          def = document.createElement("div");
          def.className = "mom-cover-default";
          def.setAttribute("data-cover-img", "");
          coverBg.insertBefore(def, coverBg.firstChild);
        }
      }
    }
    function setCover(ctx, url) {
      ctx.data().config.cover = url || "";
      applyCoverDom(ctx.container, url || "");
      ctx.save();
      try {
        ctx.reApp();
      } catch (e) {
      }
      ctx.showMessage && ctx.showMessage(url ? "\u5C01\u9762\u5DF2\u66F4\u65B0" : "\u5DF2\u6062\u590D\u9ED8\u8BA4\u5C01\u9762");
    }
    function uploadCover(ctx) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async () => {
        const f = (input.files || [])[0];
        if (input.parentNode) input.remove();
        if (!f) return;
        ctx.showMessage && ctx.showMessage("\u5C01\u9762\u4E0A\u4F20\u4E2D\u2026");
        const path = await uploadAsset(f);
        if (!path) {
          ctx.showMessage && ctx.showMessage("\u5C01\u9762\u4E0A\u4F20\u5931\u8D25");
          return;
        }
        setCover(ctx, path);
      };
      document.body.appendChild(input);
      input.click();
    }
    function deleteCover(ctx) {
      void showConfirm(ctx, "\u5220\u9664\u5C01\u9762\u5E76\u6062\u590D\u9ED8\u8BA4\uFF1F", { danger: true, ok: "\u5220\u9664" }).then((ok) => {
        if (!ok) return;
        setCover(ctx, "");
      });
    }
    async function openResourcePicker(ctx) {
      const names = [];
      try {
        const list = await globalThis.__DF_ASSETS.listMedia();
        const all = (list || []).slice();
        await Promise.all(all.map((n) => globalThis.__DF_ASSETS.load(ASSET_PREFIX + n).catch(() => null)));
        all.forEach((n) => names.push(n));
      } catch (e) {
      }
      const imgs = names.filter((n) => /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(n));
      const overlay = overlayBase();
      overlay.innerHTML = `
    <div class="mom-modal mom-modal-sm">
      <div class="mom-modal-head"><span>\u4ECE\u65E5\u8BB0\u6D41\u8D44\u6E90\u9009\u62E9\u5C01\u9762</span><button class="mom-modal-x" data-x>\u2715</button></div>
      <div class="mom-picker-grid">${imgs.length ? imgs.map((n) => `<button class="mom-picker-item" data-path="${esc(n)}" title="${esc(n)}" style="background-image:url(&quot;${esc(ASSET_PREFIX + n)}&quot;)"></button>`).join("") : '<div class="mom-empty">\u6682\u65E0\u53EF\u7528\u56FE\u7247</div>'}</div>
    </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.remove();
        if (e.target.closest("[data-x]")) overlay.remove();
        const item = e.target.closest("[data-path]");
        if (item) {
          setCover(ctx, ASSET_PREFIX + item.dataset.path);
          overlay.remove();
        }
      });
    }
    function readAsDataURL(file) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
    }
    function editorIsVideoSrc(src) {
      return /\.(mp4|mov|webm|m4v|ogg|ogv)(\?|#|$)/i.test(src) || /^data:video\//i.test(src);
    }
    async function saveVideoToAssets(file) {
      const uploaded = await uploadDiaryflowFile(file);
      if (uploaded) return uploaded;
      return readAsDataURL(file);
    }
    function openEditor(ctx, item) {
      const data = ctx.data();
      const cfg = data.config || {};
      const isEdit = !!item;
      const d = { text: "", link: "", linkTitle: "", location: "", tags: [], images: [] };
      if (isEdit) Object.assign(d, item, { images: (item.images || []).filter(Boolean).slice(0, 9) });
      const page = ctx.publishPage || ctx.container;
      const show = () => {
        if (ctx.publishPage) ctx.publishPage.hidden = false;
      };
      const close = () => {
        if (ctx.publishPage) ctx.publishPage.hidden = true;
      };
      page.innerHTML = `
    <div class="mom-publish">
      <div class="mom-publish-nav">
        <button class="mom-publish-back" data-pclose type="button" title="\u8FD4\u56DE">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
        </button>
        <div class="mom-publish-title">${isEdit ? "\u7F16\u8F91" : "\u53D1\u8868"}</div>
        <button class="mom-publish-submit" data-save type="button">${isEdit ? "\u4FDD\u5B58" : "\u53D1\u8868"}</button>
      </div>
      <div class="mom-publish-content">
        <div class="mom-publish-card mom-publish-card--editor">
          <textarea class="mom-publish-textarea" data-text placeholder="\u8FD9\u4E00\u523B\u7684\u60F3\u6CD5...">${esc(d.text)}</textarea>
        </div>
        <div class="mom-publish-card mom-publish-imgcard" data-imgs>
          <div class="mom-publish-grid-add" data-imgadd title="\u6DFB\u52A0\u56FE\u7247\u6216\u89C6\u9891">\uFF0B</div>
          <input type="file" accept="image/*,video/*" multiple data-imgfile hidden>
        </div>
        <div class="mom-publish-card mom-publish-info">
          <input type="date" class="mom-publish-inp" data-date value="${d.createdAt ? toISODate(d.createdAt) : toISODate(Date.now())}">
          <input type="text" class="mom-publish-inp mom-publish-info-loc" data-location placeholder="\u5730\u70B9..." value="${esc(d.location)}">
          <input type="text" class="mom-publish-inp mom-publish-info-tags" data-tags placeholder="\u6807\u7B7E\uff08\u7528\u9017\u53F7\u3001\u7A7A\u683C\u6216 # \u5206\u9694\uff09" value="${esc((d.tags || []).join(", "))}">
        </div>
      </div>
    </div>`;
      show();
      const q = (s) => page.querySelector(s);
      const imgs = q("[data-imgs]");
      const renderImgs = () => {
        imgs.querySelectorAll(".mom-publish-grid-prev").forEach((n) => n.remove());
        d.images.forEach((src, i) => {
          if (!src) return;
          const w = document.createElement("div");
          w.className = "mom-publish-grid-prev";
          const preview = editorIsVideoSrc(src) ? `<span class="mom-publish-prev-media"><video class="mom-publish-grid-prev-video" src="${esc(src)}#t=0.1" data-vthumb="${esc(src)}" muted playsinline preload="metadata"></video><span class="mom-publish-prev-play">\u25B6</span></span>` : `<img src="${esc(src)}">`;
          w.innerHTML = `${preview}<button class="mom-publish-grid-x" data-rmimg="${i}" type="button">\u2715</button>`;
          imgs.insertBefore(w, imgs.querySelector("[data-imgadd]"));
        });
        try { render2.hydrateVideoThumbs(page); } catch (e) {
        }
      };
      try { renderImgs(); } catch (e) { console.error("[diaryflow] renderImgs error:", e); }
      page.querySelector("[data-pclose]").addEventListener("click", close);
      page.querySelector("[data-save]").addEventListener("click", () => {
        const text = q("[data-text]").value.trim();
        if (!text && !d.images.length) {
          ctx.showMessage("\u5199\u70B9\u4EC0\u4E48\u5427");
          return;
        }
        d.text = text;
        d.location = q("[data-location]").value.trim();
        d.tags = (q("[data-tags]").value || "").split(/[,\uFF0C\s]+/).map((t) => t.replace(/^#/, "").trim()).filter(Boolean).slice(0, 20);
        const dateVal = q("[data-date]").value;
        const now = /* @__PURE__ */ new Date();
        if (dateVal) {
          const dv = /* @__PURE__ */ new Date(`${dateVal}T12:00:00`);
          if (!isNaN(dv.getTime())) {
            d.createdAt = dv.getTime();
            d.created = `${dateVal} 12:00`;
          } else if (!d.createdAt) {
            d.createdAt = now.getTime();
            d.created = fmtDisplay(now);
          }
        } else if (!d.createdAt) {
          d.createdAt = now.getTime();
          d.created = fmtDisplay(now);
        }
        if (isEdit) {
          const items = ctx.data().items;
          const idx = items.findIndex((i) => String(i.id) === String(item.id));
          if (idx >= 0) items[idx] = d;
        } else {
          if (!d.id) Object.assign(d, { id: genId(), liked: false, comments: [], pinned: false });
          ctx.data().items.unshift(d);
        }
        ctx.referencedConfig = cfg;
        ctx.showMessage(isEdit ? "\u5DF2\u4FDD\u5B58" : "\u5DF2\u53D1\u5E03");
        ctx.save().then(() => ctx.reApp());
        close();
      });
      q("[data-imgadd]").addEventListener("click", () => q("[data-imgfile]").click());
      q("[data-imgfile]").addEventListener("change", (e) => {
        const files = Array.from(e.target.files || []);
        if (d.images.length + files.length > 9) {
          ctx.showMessage("\u6700\u591A 9 \u9879\u56FE\u7247/\u89C6\u9891");
          return;
        }
        files.forEach((file) => {
          const isVid = file.type && file.type.startsWith("video/");
          const proceed = (src) => {
            if (src) d.images.push(src);
            renderImgs();
          };
          if (isVid) {
            ctx.showMessage && ctx.showMessage("\u89C6\u9891\u4E0A\u4F20\u4E2D\u2026");
            saveVideoToAssets(file).then(proceed).catch(() => proceed(""));
          } else {
            ctx.showMessage && ctx.showMessage("\u56FE\u7247\u4E0A\u4F20\u4E2D\u2026");
            saveImageToAssets(file).then(proceed).catch(() => proceed(""));
          }
        });
        e.target.value = "";
      });
      imgs.addEventListener("click", (e) => {
        const rm = e.target.closest("[data-rmimg]");
        if (!rm) return;
        d.images.splice(Number(rm.dataset.rmimg), 1);
        renderImgs();
      });
      setTimeout(() => {
        const ta = q("[data-text]");
        if (ta) ta.focus();
      }, 30);
    }
    function toISODate(ts) {
      const dt = new Date(ts);
      return `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`;
    }
    function changeTime(ctx, it) {
      const overlay = overlayBase("mom-time");
      overlay.innerHTML = `
    <div class="mom-modal mom-modal-sm">
      <div class="mom-modal-head"><span>\u4FEE\u6539\u65F6\u95F4</span><button class="mom-modal-x" data-x>\u2715</button></div>
      <div class="mom-modal-body">
        <input type="datetime-local" class="mom-inp" data-dt value="${toISO(it.createdAt || Date.now())}">
      </div>
      <div class="mom-modal-foot">
        <button class="mom-btn" data-x>\u53D6\u6D88</button>
        <button class="mom-btn mom-btn-primary" data-save>\u786E\u5B9A</button>
      </div>
    </div>`;
      document.body.appendChild(overlay);
      const save = () => {
        const v = overlay.querySelector("[data-dt]").value;
        if (v) {
          const d = new Date(v);
          it.createdAt = d.getTime();
          it.created = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
          ctx.save().then(() => ctx.reApp());
        }
        overlay.remove();
      };
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.remove();
        if (e.target.closest("[data-x]")) overlay.remove();
        if (e.target.closest("[data-save]")) save();
      });
    }
    function openSettings(ctx) {
      const cfg = ctx.data().config || {};
      const overlay = overlayBase("mom-settings");
      overlay.innerHTML = `
    <div class="mom-modal">
      <div class="mom-modal-head"><span>\u8BBE\u7F6E\u4E0E\u5BFC\u51FA</span><button class="mom-modal-x" data-x>\u2715</button></div>
      <div class="mom-modal-body">
        <label class="mom-field">\u6635\u79F0<input class="mom-inp" data-nick value="${esc(cfg.nickname || "")}"></label>
        <label class="mom-field">\u7B7E\u540D<input class="mom-inp" data-sig value="${esc(cfg.signature || "")}"></label>
        <div class="mom-field">
          <span>\u5934\u50CF</span>
          <label class="mom-btn mom-btn-small">\u4E0A\u4F20\u5934\u50CF<input type="file" accept="image/*" hidden data-avatar></label>
          <span class="mom-hint">\u5C06\u4FDD\u5B58\u81F3\u65E5\u8BB0\u6D41\u4E13\u5C5E\u76EE\u5F55\uFF0C\u5EFA\u8BAE\u5C0F\u56FE</span>
        </div>
        <div class="mom-field">
          <span>\u5C01\u9762</span>
          <label class="mom-btn mom-btn-small">\u4E0A\u4F20\u5C01\u9762<input type="file" accept="image/*" hidden data-cover></label>
        </div>
        <div class="mom-field">
          <span>\u9501\u5C4F</span>
          <label class="mom-switch"><span class="mom-switch-lab">\u542F\u7528\u9501\u5C4F</span><input type="checkbox" data-lockcheck ${cfg.lockEnabled ? "checked" : ""}><i></i></label>
          <input class="mom-inp" placeholder="\u9501\u5C4F\u5BC6\u7801\uFF08\u7559\u7A7A\u5219\u5173\u95ED\u9501\u5C4F\uFF09" type="password" data-lockpasscode value="${esc(cfg.lockPasscode || "")}">
          <label class="mom-btn mom-btn-small">\u4E0A\u4F20\u9501\u5C4F\u80CC\u666F<input type="file" accept="image/*" hidden data-lockbg></label>
          ${cfg.lockBg ? `<span class="mom-hint">\u5DF2\u8BBE\u7F6E\u80CC\u666F\uFF0C\u91CD\u65B0\u4E0A\u4F20\u53EF\u66FF\u6362</span>` : ""}
        </div>
        <div class="mom-field mom-field-col">
          <span>\u5BFC\u51FA</span>
          <div class="mom-btn-row">
            <button class="mom-btn mom-btn-small" data-export="md">Markdown</button>
            <button class="mom-btn mom-btn-small" data-export="word">Word</button>
            <button class="mom-btn mom-btn-small" data-export="json">JSON \u5907\u4EFD</button>
          </div>
        </div>
        </div>
      <div class="mom-modal-foot">
        <button class="mom-btn" data-x>\u5173\u95ED</button>
        <button class="mom-btn mom-btn-primary" data-save>\u4FDD\u5B58</button>
      </div>
    </div>`;
      document.body.appendChild(overlay);
      const readFileAsDataURL = (file) => new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      overlay.addEventListener("change", async (e) => {
        const t = e.target;
        if (t.matches("[data-avatar]")) {
          const f = (t.files || [])[0];
          if (!f) return;
          const url = await saveImageToAssets(f);
          if (url) {
            cfg.avatar = url;
            ctx.showMessage("\u5934\u50CF\u5DF2\u66F4\u65B0");
          }
        } else if (t.matches("[data-cover]")) {
          const f = (t.files || [])[0];
          if (!f) return;
          const url = await saveImageToAssets(f);
          if (url) {
            cfg.cover = url;
            ctx.showMessage("\u5C01\u9762\u5DF2\u66F4\u65B0");
          }
        } else if (t.matches("[data-lockbg]")) {
          const f = (t.files || [])[0];
          if (!f) return;
          const url = await saveImageToAssets(f);
          if (url) {
            cfg.lockBg = url;
            ctx.showMessage("\u9501\u5C4F\u80CC\u666F\u5DF2\u66F4\u65B0");
          }
        }
      });
      overlay.addEventListener("click", async (e) => {
        if (e.target === overlay) overlay.remove();
        if (e.target.closest("[data-x]")) overlay.remove();
        if (e.target.closest("[data-save]")) {
          cfg.nickname = overlay.querySelector("[data-nick]").value.trim() || cfg.nickname;
          cfg.signature = overlay.querySelector("[data-sig]").value.trim();
          cfg.lockEnabled = overlay.querySelector("[data-lockcheck]").checked;
          cfg.lockPasscode = overlay.querySelector("[data-lockpasscode]").value.trim();
          ctx.__unlocked = !cfg.lockEnabled || !cfg.lockPasscode ? true : false;
          ctx.showMessage("\u5DF2\u4FDD\u5B58");
          ctx.save().then(() => ctx.reApp());
          overlay.remove();
        }
        if (e.target.closest("[data-export]")) {
          const kind = e.target.closest("[data-export]").dataset.export;
          try {
            await exp.export(ctx, kind);
          } catch (err) {
            ctx.showMessage("\u5BFC\u51FA\u5931\u8D25: " + err.message);
          }
        }
      });
    }
    function overlayBase(cls) {
      const div = document.createElement("div");
      const dark = globalThis.__DF_IS_DARK ? globalThis.__DF_IS_DARK() : false;
      div.className = "mom-overlay orca-df-scope" + (dark ? " orca-df-dark" : "") + " " + (cls || "");
      return div;
    }
    function toISO(ts) {
      const d = new Date(ts);
      return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
    }
    module2.exports = { register, openEditor, openSettings };
  }
});



// ===== Orca Note entry =====
var ORCA_CSS = "/* src/style.css */\n.mom-root {\n  position: relative;\n  height: 100%;\n  min-height: 0;\n  overflow: hidden;\n  display: flex;\n  flex-direction: column;\n  background: var(--b3-theme-background, #fff);\n  font-family: inherit;\n  color: var(--b3-theme-on-background, #222);\n}\n.mom-scroll {\n  flex: 1 1 auto;\n  min-height: 0;\n  overflow-y: auto;\n  overflow-x: hidden;\n  display: flex;\n  flex-direction: column;\n}\n.mom-cover {\n  position: relative;\n  height: clamp(170px, 26vh, 300px);\n  flex-shrink: 0;\n  overflow: hidden;\n}\n.mom-cover-bg {\n  height: 100%;\n  position: relative;\n  overflow: hidden;\n}\n.mom-cover-img {\n  position: absolute;\n  inset: 0;\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n  display: block;\n}\n.mom-cover-default {\n  position: absolute;\n  inset: 0;\n  background:\n    linear-gradient(\n      150deg,\n      var(--b3-theme-primary, #4e6ef2) 0%,\n      color-mix(in srgb, var(--b3-theme-primary, #4e6ef2) 45%, #0c0c20) 100%);\n}\n.mom-cover-shade {\n  position: absolute;\n  inset: 0;\n  z-index: 1;\n  background:\n    linear-gradient(\n      180deg,\n      rgba(0, 0, 0, .06),\n      rgba(0, 0, 0, .4));\n}\n.mom-cover-stats {\n  position: absolute;\n  bottom: 24px;\n  right: 16px;\n  z-index: 10;\n  font-size: 13px;\n  color: #fff;\n  padding: 5px 12px;\n  border-radius: 999px;\n  background: rgba(0, 0, 0, .28);\n  backdrop-filter: blur(6px);\n  -webkit-backdrop-filter: blur(6px);\n  text-shadow: 0 1px 2px rgba(0, 0, 0, .3);\n  white-space: nowrap;\n}\n.mom-cover-settings {\n  position: absolute;\n  top: 14px;\n  right: 14px;\n  z-index: 12;\n  width: 30px;\n  height: 30px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  border: none;\n  border-radius: 8px;\n  background: rgba(255, 255, 255, .28);\n  color: #fff;\n  cursor: pointer;\n  transition: background .18s ease, transform .15s ease;\n}\n.mom-cover-settings:hover {\n  background: rgba(255, 255, 255, .5);\n  transform: scale(1.05);\n}\n.mom-avatar-ph {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background:\n    linear-gradient(\n      135deg,\n      var(--b3-theme-primary, #4e6ef2),\n      color-mix(in srgb, var(--b3-theme-primary, #4e6ef2) 52%, #0c0c20));\n  color: #fff;\n  font-weight: 600;\n}\n.mom-filter-row {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n.mom-actions {\n  display: flex;\n  gap: 8px;\n}\n.mom-actions .mom-btn-primary {\n  margin-left: auto;\n}\n.mom-chip {\n  border: 1px solid var(--b3-border-color, #ddd);\n  background: transparent;\n  color: var(--b3-theme-on-background, #333);\n  border-radius: 999px;\n  padding: 3px 10px;\n  font-size: 12px;\n  cursor: pointer;\n}\n.mom-chip.active {\n  border-color: var(--b3-theme-primary, #4e6ef2);\n  color: #fff;\n  background: var(--b3-theme-primary, #4e6ef2);\n}\n.mom-btn {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  border: 1px solid var(--b3-border-color, #ddd);\n  background: transparent;\n  color: var(--b3-theme-on-background, #333);\n  border-radius: 6px;\n  padding: 5px 12px;\n  font-size: 13px;\n  cursor: pointer;\n}\n.mom-btn:hover {\n  background: var(--b3-theme-background-light, #f2f2f2);\n}\n.mom-btn-primary {\n  background: var(--b3-theme-primary, #4e6ef2);\n  border-color: var(--b3-theme-primary, #4e6ef2);\n  color: #fff;\n}\n.mom-btn-primary:hover {\n  opacity: .9;\n}\n.mom-btn-small {\n  padding: 3px 9px;\n  font-size: 12px;\n}\n.mom-btn-danger {\n  border-color: #e05050;\n  color: #e05050;\n}\n.mom-btn-danger:hover {\n  background: #fdecec;\n}\n.mom-signature {\n  background-color: var(--moments-signature-bg, #f7f7f7);\n  padding: 14px 16px 10px;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  flex-wrap: wrap;\n  flex-shrink: 0;\n}\n.mom-signature-tools {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  flex-wrap: wrap;\n}\n.mom-cover-tool {\n  display: inline-flex !important;\n  align-items: center;\n  justify-content: center;\n  gap: 4px;\n  height: 30px;\n  padding: 0 12px;\n  border: none;\n  border-radius: 8px;\n  background: rgba(255, 255, 255, .78);\n  color: #333;\n  font-size: 12px;\n  cursor: pointer;\n  box-shadow: 0 1px 4px rgba(0, 0, 0, .12);\n  transition:\n    background .18s ease,\n    transform .15s ease,\n    box-shadow .18s ease;\n  box-sizing: border-box;\n}\n.mom-cover-tool:hover {\n  background: #fff;\n  transform: translateY(-1px);\n}\n.mom-cover-tool-danger:hover {\n  background: #ff6b6b;\n  color: #fff;\n}\n.mom-signature-text {\n  font-size: 13px;\n  color: var(--moments-signature-text, #888);\n  line-height: 1.5;\n  margin-left: auto;\n  max-width: 40%;\n  word-break: break-word;\n}\n.mom-pin-strip {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  padding: 10px 16px;\n  margin: 8px auto 0;\n  width: 73%;\n  box-sizing: border-box;\n  background-color: color-mix(in srgb, var(--b3-theme-surface, #fff) 30%, transparent);\n  border-radius: 8px;\n  border: 1px solid color-mix(in srgb, var(--moments-card-border, #ddd) 75%, transparent);\n  cursor: pointer;\n  flex-shrink: 0;\n}\n.mom-pin-strip-label {\n  font-size: 12px;\n  font-weight: 600;\n  color: var(--b3-theme-on-background, #333);\n  flex-shrink: 0;\n}\n.mom-pin-strip-thumbs {\n  display: flex;\n  gap: 12px;\n  overflow: hidden;\n  flex: 1;\n}\n.mom-pin-group {\n  display: grid;\n  gap: 2px;\n  padding: 0;\n  border: none;\n  background: none;\n  cursor: pointer;\n  flex-shrink: 0;\n}\n.mom-pin-group:hover {\n  opacity: .9;\n}\n.mom-pin-thumb {\n  position: relative;\n  overflow: hidden;\n  border-radius: 4px;\n}\n.mom-pin-thumb img {\n  width: 44px;\n  height: 44px;\n  object-fit: cover;\n  display: block;\n}\n.mom-pin-thumb-video,\n.mom-cal-thumb-video {\n  background: #000;\n}\n.mom-pin-thumb-single img {\n  width: 88px;\n  height: 88px;\n}\n.mom-pin-thumb-text {\n  width: 88px;\n  height: 88px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: color-mix(in srgb, var(--b3-theme-surface, #fff) 40%, transparent);\n}\n.mom-pin-text {\n  font-size: 12px;\n  color: var(--b3-theme-on-background, #333);\n  padding: 4px;\n  word-break: break-word;\n  line-height: 1.4;\n}\n.mom-pin-text-center {\n  font-size: 13px;\n  font-weight: 600;\n}\n.mom-pin-text-flow {\n  display: -webkit-box;\n  -webkit-line-clamp: 3;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n}\n.mom-pin-thumb-more {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: rgba(0, 0, 0, .45);\n  color: #fff;\n  font-size: 16px;\n  font-weight: 600;\n}\n.mom-list {\n  flex: 0 0 auto;\n  overflow: visible;\n  padding: 14px 0 90px;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 12px;\n}\n.mom-filter-bar {\n  width: 73%;\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.mom-empty {\n  text-align: center;\n  color: #999;\n  margin: 72px auto 0;\n  font-size: 14px;\n  max-width: 240px;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 6px;\n}\n.mom-empty-ico {\n  font-size: 40px;\n  line-height: 1;\n  margin-bottom: 6px;\n  opacity: .9;\n}\n.mom-empty-title {\n  font-size: 16px;\n  font-weight: 600;\n  color: var(--b3-theme-on-background, #333);\n  margin: 0;\n}\n.mom-empty-sub {\n  font-size: 13px;\n  color: #999;\n  margin: 0;\n}\n.mom-empty-btn {\n  margin-top: 14px;\n}\n.mom-empty-result {\n  margin-top: 72px;\n}\n.mom-item {\n  content-visibility: auto;\n  contain-intrinsic-size: auto 250px;\n  display: flex;\n  position: relative;\n  border-radius: 8px;\n  padding: 16px;\n  background-color: color-mix(in srgb, var(--b3-theme-surface, #fff) 30%, transparent);\n  border: 1px solid color-mix(in srgb, var(--moments-card-border, #ddd) 75%, transparent);\n  width: 73%;\n  box-sizing: border-box;\n}\n.mom-item:hover {\n  border-color: color-mix(in srgb, var(--b3-theme-primary, #4e6ef2) 55%, transparent);\n}\n.mom-pin-badge {\n  position: absolute;\n  top: 8px;\n  left: 8px;\n  z-index: 3;\n  display: flex;\n  align-items: center;\n  color: var(--b3-theme-primary, #4e6ef2);\n}\n.mom-item-avatar {\n  width: 48px;\n  height: 48px;\n  border-radius: 6px;\n  object-fit: cover;\n  flex-shrink: 0;\n  margin-right: 12px;\n  background-color: var(--moments-border, #ddd);\n}\n.mom-item-avatar.mom-avatar-ph {\n  font-size: 20px;\n}\n.mom-item-content {\n  flex: 1;\n  min-width: 0;\n}\n.mom-item-name {\n  font-size: 16px;\n  color: var(--b3-theme-on-background, #333);\n  font-weight: 600;\n  line-height: 1.4;\n  margin-bottom: 4px;\n}\n.mom-item-text {\n  font-size: 14px;\n  color: var(--b3-theme-on-background, #333);\n  line-height: 1.8;\n  margin-bottom: 6px;\n  word-break: break-word;\n  white-space: pre-wrap;\n  user-select: text;\n}\n.mom-no-text {\n  color: #bbb;\n  font-size: 13px;\n}\n.mom-long-toggle {\n  font-size: 12px;\n  color: var(--b3-theme-primary, #4e6ef2);\n  background: none;\n  border: none;\n  cursor: pointer;\n  padding: 0;\n  margin-top: 2px;\n}\n.mom-card-imgs {\n  display: grid;\n  gap: 4px;\n  margin-top: 10px;\n}\n.mom-grid-1 {\n  grid-template-columns: 1fr;\n  max-width: 320px;\n}\n.mom-grid-2 {\n  grid-template-columns: 1fr 1fr;\n}\n.mom-grid-3 {\n  grid-template-columns: 1fr 1fr 1fr;\n}\n.mom-img-cell {\n  position: relative;\n  overflow: hidden;\n  border-radius: 6px;\n  aspect-ratio: 1;\n  background: #f0f0f0;\n}\n.mom-img-cell img {\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n  cursor: zoom-in;\n  display: block;\n}\n.mom-card-link {\n  margin-top: 10px;\n}\n.mom-card-link a {\n  color: var(--b3-theme-primary, #4e6ef2);\n  text-decoration: none;\n  font-size: 13px;\n}\n.mom-card-link a:hover {\n  text-decoration: underline;\n}\n.mom-bottom-space {\n  height: 90px;\n  flex-shrink: 0;\n}\n.mom-fab-stack {\n  position: absolute;\n  z-index: 40;\n  right: 16px;\n  bottom: 48px;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 8px;\n  margin: 0;\n  padding-right: 0;\n  flex: none;\n  pointer-events: none;\n}\n.mom-outline-fab {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 44px;\n  height: 44px;\n  padding: 0;\n  border: none;\n  border-radius: 50%;\n  cursor: pointer;\n  color: var(--b3-theme-on-background, #333);\n  background: var(--b3-theme-surface, #fff);\n  border: 1px solid var(--b3-border-color, #ddd);\n  box-shadow: 0 4px 14px rgba(0, 0, 0, .18);\n  transition: transform .15s ease, box-shadow .15s ease;\n  flex: none;\n  pointer-events: auto;\n}\n.mom-outline-fab:hover {\n  transform: translateY(-1px);\n  box-shadow: 0 6px 18px rgba(0, 0, 0, .24);\n}\n.mom-fab-stack.is-mobile {\n  position: absolute;\n  right: 16px;\n  bottom: 80px;\n  left: auto;\n  margin: 0;\n}\n.mom-outline-fab.is-mobile {\n  transform: none;\n}\n.mom-lightbox {\n  position: fixed;\n  inset: 0;\n  background: rgba(0, 0, 0, .85);\n  z-index: 1002;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  cursor: zoom-out;\n}\n.mom-lightbox-img {\n  max-width: 92%;\n  max-height: 88vh;\n  border-radius: 6px;\n  object-fit: contain;\n}\n.mom-lightbox-close {\n  position: absolute;\n  top: 16px;\n  right: 16px;\n  z-index: 2;\n  width: 36px;\n  height: 36px;\n  border: none;\n  border-radius: 50%;\n  background: rgba(255, 255, 255, .15);\n  color: #fff;\n  font-size: 22px;\n  line-height: 1;\n  cursor: pointer;\n}\n.mom-lightbox-close:hover {\n  background: rgba(255, 255, 255, .28);\n}\n.mom-lightbox-nav {\n  position: absolute;\n  top: 50%;\n  transform: translateY(-50%);\n  z-index: 2;\n  width: 44px;\n  height: 44px;\n  border: none;\n  border-radius: 50%;\n  background: rgba(255, 255, 255, .15);\n  color: #fff;\n  font-size: 28px;\n  line-height: 1;\n  cursor: pointer;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n.mom-lightbox-nav:hover:not(:disabled) {\n  background: rgba(255, 255, 255, .28);\n}\n.mom-lightbox-nav:disabled {\n  opacity: .25;\n  cursor: default;\n}\n.mom-lightbox-prev {\n  left: 12px;\n}\n.mom-lightbox-next {\n  right: 12px;\n}\n.mom-lightbox-dots {\n  position: absolute;\n  bottom: 20px;\n  left: 50%;\n  transform: translateX(-50%);\n  display: flex;\n  gap: 8px;\n  z-index: 2;\n}\n.mom-lightbox-dot {\n  width: 8px;\n  height: 8px;\n  padding: 0;\n  border: none;\n  border-radius: 50%;\n  background: rgba(255, 255, 255, .35);\n  cursor: pointer;\n}\n.mom-lightbox-dot.active {\n  background: #fff;\n  transform: scale(1.15);\n}\n.mom-lightbox-counter {\n  position: absolute;\n  top: 20px;\n  left: 50%;\n  transform: translateX(-50%);\n  color: rgba(255, 255, 255, .85);\n  font-size: 13px;\n  z-index: 2;\n  pointer-events: none;\n}\n.mom-confirm-msg {\n  margin: 0;\n  font-size: 14px;\n  line-height: 1.6;\n  color: var(--b3-theme-on-background);\n  white-space: pre-wrap;\n}\n.north-luna-moments-item-header {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  margin-bottom: 10px;\n}\n.north-luna-moments-item-header .mom-avatar {\n  width: 40px;\n  height: 40px;\n  border-radius: 8px;\n  object-fit: cover;\n  flex-shrink: 0;\n}\n.north-luna-moments-item-header .mom-avatar-ph {\n  width: 40px;\n  height: 40px;\n  border-radius: 8px;\n  font-size: 16px;\n}\n.north-luna-moments-item-name {\n  font-size: 15px;\n  font-weight: 600;\n  color: var(--b3-theme-on-background);\n  line-height: 1.3;\n}\n.mom-lightbox[hidden] {\n  display: none;\n}\n.mom-lightbox img {\n  max-width: 92%;\n  max-height: 92%;\n  border-radius: 6px;\n}\n.mom-overlay {\n  position: fixed;\n  inset: 0;\n  background: rgba(0, 0, 0, .4);\n  z-index: 2147483000;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  box-sizing: border-box;\n  padding: max(16px, env(safe-area-inset-top, 0px)) 16px max(16px, env(safe-area-inset-bottom, 0px));\n}\n.mom-modal {\n  background: var(--b3-theme-background, #fff);\n  border-radius: 12px;\n  width: min(560px, 92vw);\n  max-height: 86vh;\n  display: flex;\n  flex-direction: column;\n  box-shadow: 0 10px 40px rgba(0, 0, 0, .3);\n}\n.mom-modal-sm {\n  width: min(340px, 90vw);\n}\n.mom-overlay.mom-settings .mom-modal {\n  width: min(320px, 92vw);\n  font-size: 16px;\n}\n.mom-overlay.mom-settings .mom-field {\n  font-size: 15px;\n}\n.mom-overlay.mom-settings .mom-modal-head {\n  font-size: 17px;\n}\n.mom-overlay.mom-settings .mom-modal-head .mom-modal-x {\n  font-size: 18px;\n}\n.mom-overlay.mom-settings .mom-inp {\n  width: 240px;\n  font-size: 15px;\n}\n.mom-overlay.mom-settings .mom-hint {\n  font-size: 13px;\n}\n.mom-overlay.mom-settings label.mom-btn:has(> input[type=\"file\"]) {\n  width: 240px;\n}\n/* ===== 日历弹窗（复刻 siyuan-moments）===== */\n.mom-overlay.mom-calendar {\n  background: rgba(0, 0, 0, .5);\n}\n.mom-calendar-modal {\n  display: contents;\n}\n.mom-calendar-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 2147483000;\n  touch-action: none;\n}\n.mom-calendar-content {\n  position: relative;\n  background: var(--b3-theme-background);\n  border-radius: 12px;\n  width: auto;\n  max-width: 1200px;\n  min-width: 0;\n  max-height: 60vh;\n  overflow: hidden;\n  z-index: 2147483001;\n  box-shadow: 0 4px 24px rgba(0, 0, 0, .3);\n  display: flex;\n  flex-direction: column;\n  transition: box-shadow .2s ease, transform .2s ease;\n  touch-action: pan-y;\n  overscroll-behavior: contain;\n}\n.mom-calendar-content.dragging {\n  transition: none;\n  cursor: grabbing;\n}\n.mom-calendar-header {\n  display: flex;\n  flex-direction: row;\n  flex-wrap: nowrap;\n  align-items: center;\n  justify-content: space-between;\n  padding: 12px 16px;\n  border-bottom: 1px solid color-mix(in srgb, var(--b3-border-color) 35%, transparent);\n  flex-shrink: 0;\n  cursor: move;\n  user-select: none;\n}\n.mom-calendar-title {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  flex: 1;\n  min-width: 0;\n  white-space: nowrap;\n  overflow: hidden;\n}\n.mom-calendar-title > span:first-child {\n  font-size: 15px;\n  font-weight: 600;\n}\n.mom-calendar-year {\n  font-size: 13px;\n  color: var(--b3-theme-primary);\n  background: transparent;\n  border: none;\n  outline: none;\n  cursor: pointer;\n  padding: 2px 4px;\n  font-family: inherit;\n  -webkit-appearance: none;\n  -moz-appearance: none;\n  appearance: none;\n  flex-shrink: 0;\n}\n.mom-calendar-modes {\n  display: inline-flex;\n  gap: 2px;\n  flex-shrink: 0;\n}\n.mom-calendar-mode {\n  border: 1px solid var(--b3-border-color);\n  background: transparent;\n  color: var(--b3-theme-on-surface);\n  font-size: 12px;\n  padding: 2px 9px;\n  border-radius: 999px;\n  cursor: pointer;\n  line-height: 1.4;\n}\n.mom-calendar-mode.on {\n  background: var(--b3-theme-primary);\n  border-color: var(--b3-theme-primary);\n  color: #fff;\n}\n.mom-calendar-count {\n  font-size: 12px;\n  color: var(--b3-theme-primary);\n  margin-left: 2px;\n  flex-shrink: 0;\n}\n.mom-calendar-close {\n  width: 28px;\n  height: 28px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n  font-size: 20px;\n  color: var(--b3-theme-on-surface);\n  border-radius: 4px;\n  flex-shrink: 0;\n}\n.mom-calendar-close:hover {\n  background-color: var(--b3-list-hover);\n}\n.mom-calendar-body {\n  padding: 16px;\n  overflow: auto;\n}\n.mom-calendar-grid {\n  width: 100%;\n  display: block;\n}\n.mom-calendar-columns {\n  display: flex;\n  gap: 4px;\n}\n.mom-calendar-column {\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n.mom-calendar-cell {\n  width: 100%;\n  min-width: 10px;\n  aspect-ratio: 1;\n  border-radius: 3px;\n  background-color: color-mix(in srgb, var(--b3-theme-surface-lighter) 40%, transparent);\n  transition: all .15s;\n  cursor: pointer;\n}\n.mom-calendar-cell:hover {\n  transform: scale(1.2);\n  box-shadow: 0 0 0 1px var(--b3-theme-primary);\n}\n.mom-calendar-cell.level-empty {\n  background-color: color-mix(in srgb, var(--b3-theme-surface-lighter) 40%, transparent);\n  opacity: .5;\n}\n.mom-calendar-cell.level-empty:hover {\n  transform: none;\n  box-shadow: none;\n}\n.mom-calendar-cell.level-1 { background-color: var(--b3-theme-primary-lightest); }\n.mom-calendar-cell.level-2 { background-color: var(--b3-theme-primary-lighter); }\n.mom-calendar-cell.level-3 { background-color: var(--b3-theme-primary-light); }\n.mom-calendar-cell.level-4 { background-color: var(--b3-theme-primary); }\n.mom-calendar-months {\n  position: relative;\n  margin-top: 8px;\n  height: 18px;\n  min-width: max-content;\n}\n.mom-calendar-month-label {\n  position: absolute;\n  transform: translateX(-50%);\n  font-size: 11px;\n  color: var(--b3-theme-on-surface-light);\n  white-space: nowrap;\n}\n.mom-calendar-photo-twocol {\n  display: flex;\n  flex-direction: column;\n  gap: 18px;\n}\n.mom-calendar-photo-month-title {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  font-size: 14px;\n  font-weight: 600;\n  color: var(--b3-theme-on-background);\n  margin: 4px 0 8px 4px;\n}\n.mom-calendar-photo-grid {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.mom-calendar-photo-row {\n  display: grid;\n  grid-template-columns: repeat(7, minmax(32px, 44px));\n  gap: 6px;\n}\n.mom-calendar-photo-cell {\n  position: relative;\n  aspect-ratio: 1;\n  width: 100%;\n  min-width: 32px;\n  max-width: 44px;\n  background-color: color-mix(in srgb, var(--b3-theme-surface-lighter) 5%, transparent);\n  border-radius: 6px;\n  border: 1px solid color-mix(in srgb, var(--b3-border-color) 20%, transparent);\n  cursor: default;\n  overflow: hidden;\n  transition: transform .15s ease, box-shadow .15s ease;\n}\n.mom-calendar-photo-cell.has-photo {\n  cursor: pointer;\n  box-shadow: 0 1px 4px rgba(0, 0, 0, .08);\n}\n.mom-calendar-photo-cell.has-photo:hover,\n.mom-calendar-photo-cell.has-record:hover {\n  transform: scale(1.05);\n  box-shadow: 0 4px 12px rgba(0, 0, 0, .15);\n  z-index: 1;\n}\n.mom-calendar-photo-cell.empty {\n  background-color: transparent;\n  border: 0;\n}\n.mom-calendar-photo-cell.has-record {\n  cursor: pointer;\n}\n.mom-calendar-photo-dot {\n  position: absolute;\n  right: 5px;\n  bottom: 5px;\n  width: 7px;\n  height: 7px;\n  border-radius: 50%;\n  background: var(--b3-theme-primary);\n  box-shadow: 0 0 0 2px color-mix(in srgb, var(--b3-theme-background) 60%, transparent);\n  z-index: 2;\n}\n.mom-calendar-photo-num {\n  position: absolute;\n  top: 4px;\n  left: 6px;\n  font-size: 11px;\n  color: var(--b3-theme-on-surface);\n  opacity: .85;\n  background: color-mix(in srgb, var(--b3-theme-background) 65%, transparent);\n  padding: 1px 5px;\n  border-radius: 3px;\n  line-height: 1.3;\n  z-index: 1;\n}\n.mom-calendar-photo-cell.has-photo .mom-calendar-photo-num {\n  color: #fff;\n  background: rgba(0, 0, 0, .45);\n  opacity: 1;\n}\n.mom-calendar-photo-img {\n  position: absolute;\n  inset: 0;\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n  z-index: 0;\n  background: var(--b3-theme-surface);\n}\n.mom-modal-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 12px 16px;\n  border-bottom: 1px solid var(--b3-border-color, #eee);\n  font-weight: 600;\n}\n.mom-modal-x {\n  border: none;\n  background: none;\n  font-size: 16px;\n  cursor: pointer;\n  color: #888;\n}\n.mom-modal-body {\n  padding: 14px 16px;\n  overflow-y: auto;\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n}\n.mom-modal-foot {\n  display: flex;\n  justify-content: flex-end;\n  gap: 8px;\n  padding: 10px 16px;\n  border-top: 1px solid var(--b3-border-color, #eee);\n}\n.mom-editor-toolbar {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  align-items: center;\n}\n.mom-inp {\n  border: 1px solid var(--b3-border-color, #ddd);\n  border-radius: 6px;\n  padding: 6px 9px;\n  font-size: 13px;\n  background: var(--b3-theme-background, #fff);\n  color: var(--b3-theme-on-background, #333);\n}\n.mom-inp-inline {\n  width: 100px;\n}\n.mom-textarea {\n  min-height: 120px;\n  width: 100%;\n  border: 1px solid var(--b3-border-color, #ddd);\n  border-radius: 8px;\n  padding: 10px;\n  font-size: 14px;\n  font-family: inherit;\n  resize: vertical;\n  background: var(--b3-theme-background, #fff);\n  color: var(--b3-theme-on-background, #333);\n}\n.mom-img-previews {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px;\n}\n.mom-img-prev {\n  position: relative;\n  width: 64px;\n  height: 64px;\n}\n.mom-img-prev img {\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n  border-radius: 6px;\n}\n.mom-img-prev-x {\n  position: absolute;\n  top: -6px;\n  right: -6px;\n  width: 18px;\n  height: 18px;\n  border-radius: 50%;\n  border: none;\n  background: #333;\n  color: #fff;\n  font-size: 11px;\n  line-height: 1;\n  cursor: pointer;\n}\n.mom-picked {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n.mom-picked-chip {\n  cursor: pointer;\n}\n.mom-pick-panel {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n.mom-field {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  font-size: 13px;\n}\n.mom-field-col {\n  align-items: flex-start;\n}\n.mom-field .mom-inp {\n  width: 100%;\n}\n.mom-hint {\n  font-size: 11px;\n  color: #999;\n}\n.mom-divider {\n  height: 1px;\n  background: var(--b3-border-color, #eee);\n}\n.mom-btn-row {\n  display: flex;\n  gap: 8px;\n  flex-wrap: wrap;\n}\n.mom-view-switch {\n  display: flex;\n  gap: 6px;\n}\n.mom-cal {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n}\n.mom-cal-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n}\n.mom-cal-nav {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n}\n.mom-cal-year {\n  font-size: 14px;\n  font-weight: 600;\n  min-width: 64px;\n  text-align: center;\n}\n.mom-cal-modes {\n  display: flex;\n  gap: 6px;\n}\n.mom-cal-months {\n  display: flex;\n  flex-direction: column;\n  gap: 16px;\n}\n.mom-cal-month {\n  background: var(--b3-theme-background, #fff);\n  border: 1px solid var(--b3-border-color, #eee);\n  border-radius: 10px;\n  padding: 10px;\n}\n.mom-cal-month-t {\n  margin: 0 0 8px;\n  font-size: 13px;\n  font-weight: 600;\n  color: var(--b3-theme-on-background, #333);\n}\n.mom-cal-grid {\n  display: grid;\n  grid-template-columns: repeat(7, 1fr);\n  gap: 4px;\n}\n.mom-cal-dow {\n  text-align: center;\n  font-size: 11px;\n  color: #aaa;\n  padding: 2px 0;\n}\n.mom-cal-blank {\n  aspect-ratio: 1;\n}\n.mom-cal-cell {\n  position: relative;\n  aspect-ratio: 1;\n  border-radius: 6px;\n  border: 1px solid transparent;\n  background: var(--b3-theme-background-light, #f4f4f4);\n  overflow: hidden;\n  cursor: pointer;\n  padding: 0;\n}\n.mom-cal-cell.has {\n  border-color: var(--b3-border-color, #ddd);\n}\n.mom-cal-cell:hover {\n  border-color: var(--b3-theme-primary, #4e6ef2);\n}\n.mom-cal-cell.is-today {\n  box-shadow: inset 0 0 0 2px var(--b3-theme-primary, #4e6ef2);\n}\n.mom-cal-cell img {\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n  display: block;\n}\n.mom-cal-daynum {\n  position: absolute;\n  left: 3px;\n  top: 3px;\n  font-size: 10px;\n  color: #fff;\n  text-shadow: 0 1px 2px rgba(0, 0, 0, .6);\n}\n.mom-cal-heatline {\n  width: 100%;\n  height: 100%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: var(--b3-theme-primary, #4e6ef2);\n  color: #fff;\n  font-size: 11px;\n  font-weight: 600;\n}\n.mom-cal-ph-cnt {\n  width: 100%;\n  height: 100%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: var(--b3-theme-primary, #4e6ef2);\n  color: #fff;\n  font-size: 13px;\n  font-weight: 600;\n}\n.mom-flash {\n  animation: mom-flash 1.6s ease;\n}\n@keyframes mom-flash {\n  0% {\n    box-shadow: 0 0 0 3px var(--b3-theme-primary, #4e6ef2);\n  }\n  100% {\n    box-shadow: 0 0 0 0 rgba(78, 110, 242, 0);\n  }\n}\n.mom-lock {\n  position: relative;\n  min-height: 100%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  overflow: hidden;\n}\n.mom-lock-bg {\n  position: absolute;\n  inset: 0;\n  background-size: cover;\n  background-position: center;\n}\n.mom-lock-bg--glass {\n  background:\n    linear-gradient(\n      180deg,\n      #fafafa,\n      #f0f0f0);\n}\n.mom-lock-panel {\n  position: relative;\n  z-index: 1;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  width: 100%;\n  height: 100%;\n  padding: 28px 26px;\n  background: transparent;\n}\n.mom-lock-top {\n  text-align: center;\n  color: #000;\n  width: 100%;\n  padding-bottom: 18px;\n  margin-bottom: 18px;\n  border-bottom: 1px solid #f0f0f0;\n}\n.mom-lock-date {\n  font-size: 12px;\n  letter-spacing: 2px;\n  color: #999;\n  text-transform: uppercase;\n}\n.mom-lock-time {\n  font-size: 44px;\n  font-weight: 200;\n  letter-spacing: 2px;\n  margin-top: 6px;\n  font-variant-numeric: tabular-nums;\n  color: #111;\n}\n.mom-lock-bottom {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  width: 100%;\n  gap: 10px;\n}\n.mom-lock-avatar {\n  width: 60px;\n  height: 60px;\n  border-radius: 50%;\n  font-size: 26px;\n}\n.mom-lock-name {\n  color: #111;\n  font-size: 14px;\n  font-weight: 600;\n}\n.mom-lock-input {\n  width: 50%;\n  border: 1px solid #e5e5e5;\n  border-radius: 10px;\n  padding: 10px 12px;\n  background: #f7f7f7;\n  color: #000;\n  font-size: 14px;\n  outline: none;\n  transition: border-color .18s ease, background .18s ease;\n}\n.mom-lock-input:focus {\n  border-color: #bbb;\n  background: #fff;\n}\n.mom-lock-input::placeholder {\n  color: #b0b0b0;\n}\n.mom-lock .mom-btn-primary {\n  width: 100%;\n  justify-content: center;\n  padding: 10px 12px;\n  border-radius: 10px;\n}\n.mom-lock-error {\n  color: #ff6b6b;\n  font-size: 12px;\n  margin: 0;\n}\n.mom-lock-hint {\n  color: #aaa;\n  font-size: 12px;\n  margin-top: 2px;\n}\n.mom-lock.shake {\n  animation: mom-shake .4s ease;\n}\n@keyframes mom-shake {\n  0%, 100% {\n    transform: translateX(0);\n  }\n  25% {\n    transform: translateX(-6px);\n  }\n  75% {\n    transform: translateX(6px);\n  }\n}\n.mom-switch {\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n  cursor: pointer;\n  font-size: 13px;\n}\n.mom-switch input {\n  display: none;\n}\n.mom-switch i {\n  width: 40px;\n  height: 22px;\n  border-radius: 999px;\n  background: #ccc;\n  position: relative;\n  transition: background .2s;\n}\n.mom-switch i::after {\n  content: \"\";\n  position: absolute;\n  top: 2px;\n  left: 2px;\n  width: 18px;\n  height: 18px;\n  border-radius: 50%;\n  background: #fff;\n  transition: transform .2s;\n  box-shadow: 0 1px 3px rgba(0, 0, 0, .3);\n}\n.mom-switch input:checked + i {\n  background: var(--b3-theme-primary, #4e6ef2);\n}\n.mom-switch input:checked + i::after {\n  transform: translateX(18px);\n}\n.mom-switch-lab {\n  cursor: pointer;\n}\n.mom-md-toolbar {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  align-items: center;\n}\n.mom-link-card {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.mom-inline-code {\n  background: var(--b3-theme-background-light, #f2f2f2);\n  border-radius: 4px;\n  padding: 1px 5px;\n  font-size: 13px;\n  font-family: var(--b3-font-family-code, monospace);\n}\n.mom-mark {\n  background: #ffe08a;\n  color: inherit;\n  padding: 0 2px;\n  border-radius: 3px;\n}\n.mom-card-text em {\n  font-style: italic;\n}\n.mom-publish-page {\n  position: absolute;\n  top: 0;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  background-color: var(--b3-theme-background, #fff);\n  z-index: 30;\n  overflow: hidden;\n  display: flex;\n  flex-direction: column;\n}\n.mom-publish-page[hidden] {\n  display: none;\n}\n.mom-publish {\n  display: flex;\n  flex-direction: column;\n  height: 100%;\n  min-height: 0;\n}\n.mom-publish-nav {\n  position: relative;\n  flex: 0 0 auto;\n  height: 44px;\n  background-color: var(--b3-theme-background, #fff);\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 0 16px;\n  border-bottom: 0.5px solid var(--moments-nav-border, #eee);\n}\n.mom-publish-back {\n  width: 24px;\n  height: 24px;\n  border: none;\n  background: transparent;\n  position: relative;\n  cursor: pointer;\n  padding: 0;\n  display: flex;\n  align-items: center;\n  justify-content: flex-start;\n}\n.mom-publish-title {\n  font-size: 17px;\n  font-weight: 600;\n  color: var(--b3-theme-on-background, #333);\n  position: absolute;\n  left: 50%;\n  transform: translateX(-50%);\n}\n.mom-publish-submit {\n  font-size: 15px;\n  font-weight: 500;\n  color: var(--b3-theme-primary, #4e6ef2);\n  background-color: color-mix(in srgb, var(--b3-theme-primary, #4e6ef2) 10%, transparent);\n  padding: 6px 16px;\n  border-radius: 4px;\n  border: none;\n  cursor: pointer;\n}\n.mom-publish-content {\n  padding: 12px;\n  flex: 1 1 auto;\n  min-height: 0;\n  overflow-y: auto;\n  overflow-x: hidden;\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n}\n.mom-publish-card {\n  background: var(--b3-theme-background-light, #f7f7f7);\n  border: 1px solid color-mix(in srgb, var(--b3-border-color, #ddd) 45%, transparent);\n  border-radius: 12px;\n  padding: 14px;\n  box-sizing: border-box;\n}\n.mom-publish-card--editor {\n  flex: 0 0 auto;\n  display: flex;\n  flex-direction: column;\n}\n.mom-publish-card--editor:focus-within {\n  border-color: var(--b3-theme-primary, #4e6ef2);\n}\n.mom-publish-textarea {\n  width: 100%;\n  min-height: 90px;\n  max-height: 40vh;\n  border: none;\n  outline: none;\n  font-size: 16px;\n  line-height: 1.6;\n  color: var(--b3-theme-on-background, #333);\n  resize: vertical;\n  overflow-y: auto;\n  font-family: inherit;\n  background: transparent;\n}\n.mom-publish-textarea::placeholder {\n  color: #aaa;\n}\n.mom-publish-imgcard {\n  display: flex;\n  align-items: flex-start;\n  flex-wrap: wrap;\n  gap: 8px;\n}\n.mom-publish-grid-add,\n.mom-publish-grid-prev {\n  width: 56px;\n  height: 56px;\n  border: 1px dashed #ccc;\n  border-radius: 8px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n  position: relative;\n  overflow: hidden;\n  box-sizing: border-box;\n  background: transparent;\n  font-size: 22px;\n  color: #999;\n  flex: none;\n}\n.mom-publish-grid-prev {\n  border-style: solid;\n  border-color: #eee;\n}\n.mom-publish-grid-prev img {\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n  display: block;\n}\n.mom-publish-grid-prev-video {\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n  display: block;\n  background: #000;\n}\n.mom-publish-prev-media {\n  position: absolute;\n  inset: 0;\n}\n.mom-publish-prev-play {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  color: #fff;\n  font-size: 18px;\n  pointer-events: none;\n  text-shadow: 0 1px 3px rgba(0, 0, 0, .6);\n}\n.mom-publish-grid-x {\n  position: absolute;\n  top: 3px;\n  right: 3px;\n  width: 18px;\n  height: 18px;\n  background-color: #FA5151;\n  border-radius: 50%;\n  border: none;\n  color: #fff;\n  font-size: 11px;\n  line-height: 1;\n  cursor: pointer;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  z-index: 10;\n  padding: 0;\n}\n.mom-publish-inp {\n  flex: none;\n  width: 100%;\n  height: 30px;\n  border: 0.5px solid color-mix(in srgb, var(--b3-border-color, #ddd) 70%, transparent);\n  border-radius: 8px;\n  padding: 0 8px;\n  font-size: 13px;\n  color: var(--b3-theme-on-background, #333);\n  background: color-mix(in srgb, var(--b3-theme-background, #fff) 55%, transparent);\n  outline: none;\n  font-family: inherit;\n  box-sizing: border-box;\n}\n.mom-publish-info {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n}\n.mom-publish-info .mom-publish-inp[type=date] {\n  flex: 1;\n  min-width: 0;\n}\n.mom-publish-info .mom-publish-inp[data-location] {\n  flex: 2;\n  min-width: 0;\n}\n.mom-picker-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));\n  gap: 6px;\n  max-height: 60vh;\n  overflow-y: auto;\n  padding: 2px;\n}\n.mom-picker-item {\n  width: 100%;\n  aspect-ratio: 1;\n  border: 1px solid var(--b3-border-color, #eee);\n  border-radius: 6px;\n  background-size: cover;\n  background-position: center;\n  background-color: var(--b3-theme-background-light, #f4f4f4);\n  cursor: pointer;\n  padding: 0;\n  box-sizing: border-box;\n}\n.mom-picker-item:hover {\n  border-color: var(--b3-theme-primary, #4e6ef2);\n}\n.mom-list {\n  --moments-text: var(--b3-theme-on-background);\n  --moments-text-secondary: var(--b3-theme-on-surface);\n  --moments-border: var(--b3-border-color);\n  --moments-card-border: var(--b3-border-color);\n  --moments-name-color: var(--b3-theme-on-background);\n  --moments-close-color: var(--b3-theme-on-surface-light);\n  --moments-link-card-bg: var(--b3-theme-surface);\n  --moments-interaction-bg: var(--b3-theme-surface);\n  --moments-action-popup-bg: var(--b3-theme-surface);\n  --moments-action-popup-text: var(--b3-theme-on-background);\n  --moments-action-popup-border: var(--b3-border-color);\n  --moments-action-popup-active-bg: var(--b3-list-hover);\n}\n.north-luna-moments-item {\n  content-visibility: auto;\n  contain-intrinsic-size: auto 250px;\n  display: flex;\n  position: relative;\n  border-radius: 14px;\n  padding: 16px;\n  background-color: color-mix(in srgb, var(--b3-theme-surface) 45%, transparent);\n  width: calc(100% - 6%);\n  margin: 0 auto;\n  box-sizing: border-box;\n  border: 1px solid color-mix(in srgb, var(--b3-theme-on-background) 6%, transparent);\n  box-shadow: 0 1px 3px rgba(0, 0, 0, .04), 0 4px 14px rgba(0, 0, 0, .05);\n  transition: box-shadow 0.22s ease, transform 0.22s ease, border-color 0.22s ease;\n}\n.north-luna-moments-item:hover {\n  transform: translateY(-2px);\n  box-shadow: 0 4px 12px rgba(0, 0, 0, .07), 0 12px 28px rgba(0, 0, 0, .10);\n  border-color: color-mix(in srgb, var(--b3-theme-on-background) 10%, transparent);\n}\n.north-luna-moments-item.popup-open {\n  z-index: 8;\n}\n.north-luna-moments-item-content {\n  flex: 1;\n  min-width: 0;\n}\n.north-luna-moments-item-text {\n  font-size: 18px;\n  color: var(--moments-text);\n  line-height: 1.75;\n  margin-bottom: 6px;\n  word-wrap: break-word;\n  white-space: pre-wrap;\n  user-select: text;\n  -webkit-user-select: text;\n  overflow: hidden;\n}\n.north-luna-moments-no-text {\n  color: var(--moments-close-color);\n  font-size: 13px;\n}\n.north-luna-moments-item-text.moments-folded {\n  max-height: calc(var(--moments-fold-line-h, 32px) * var(--moments-fold-lines, 6));\n  -webkit-mask-image:\n    linear-gradient(\n      to bottom,\n      black calc(100% - 36px),\n      transparent 100%);\n  mask-image:\n    linear-gradient(\n      to bottom,\n      black calc(100% - 36px),\n      transparent 100%);\n  -webkit-mask-size: 100% 100%;\n  mask-size: 100% 100%;\n  -webkit-mask-repeat: no-repeat;\n  mask-repeat: no-repeat;\n}\n.north-luna-moments-item.moments-expanded .north-luna-moments-item-text.moments-folded {\n  max-height: none;\n  -webkit-mask-image: none;\n  mask-image: none;\n}\n.north-luna-moments-expand {\n  display: none;\n  align-items: center;\n  justify-content: flex-end;\n  gap: 2px;\n  margin-top: 4px;\n  margin-bottom: 10px;\n  color: var(--b3-theme-on-surface-light);\n  font-size: 13px;\n  cursor: pointer;\n  user-select: none;\n  -webkit-user-select: none;\n  transition: color 0.2s;\n}\n.north-luna-moments-expand:hover {\n  color: var(--b3-theme-primary);\n}\n.north-luna-moments-item.moments-has-fold .north-luna-moments-expand {\n  display: flex;\n}\n.north-luna-moments-expand .moments-expand-icon {\n  width: 14px;\n  height: 14px;\n}\n.north-luna-moments-item-text code,\n.north-luna-moments-item-text .mom-inline-code {\n  color: var(--b3-theme-primary);\n  background-color: color-mix(in srgb, var(--b3-theme-primary) 10%, transparent);\n  padding: 2px 4px;\n  border-radius: 7px;\n  font-size: 0.9em;\n  font-family: var(--b3-font-family-code, monospace);\n}\n.north-luna-moments-item-text mark {\n  background-color: #ffe08a;\n  padding: 0 2px;\n  border-radius: 2px;\n}\n.north-luna-moments-item-text strong {\n  font-weight: 600;\n}\n.north-luna-moments-media {\n  margin-bottom: 8px;\n}\n.north-luna-moments-video {\n  width: 100%;\n  max-height: 420px;\n  border-radius: 8px;\n  background: #000;\n  display: block;\n}\n.north-luna-moments-grid-cel {\n  position: relative;\n  display: block;\n  cursor: pointer;\n  overflow: hidden;\n  border-radius: 8px;\n}\n.north-luna-moments-grid-video-el {\n  width: 100%;\n  aspect-ratio: 1;\n  object-fit: cover;\n  display: block;\n  background: #000;\n}\n.north-luna-moments-image-grid.single .north-luna-moments-grid-video-el {\n  aspect-ratio: auto;\n  max-height: 280px;\n  width: 100%;\n}\n.north-luna-moments-grid-play {\n  position: absolute;\n  left: 50%;\n  top: 50%;\n  transform: translate(-50%, -50%);\n  width: 42px;\n  height: 42px;\n  border-radius: 50%;\n  background: rgba(0, 0, 0, .55);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  color: #fff;\n  pointer-events: none;\n}\n.north-luna-moments-grid-play svg {\n  width: 22px;\n  height: 22px;\n}\n.mom-lightbox video {\n  max-width: 92vw;\n  max-height: 80vh;\n  border-radius: 8px;\n  background: #000;\n}\n.north-luna-moments-image-grid {\n  display: grid;\n  gap: 4px;\n}\n.north-luna-moments-image-grid.single {\n  grid-template-columns: 1fr;\n  max-width: 300px;\n}\n.north-luna-moments-image-grid.double {\n  grid-template-columns: repeat(2, 1fr);\n  max-width: 300px;\n}\n.north-luna-moments-image-grid.triple {\n  grid-template-columns: repeat(3, 1fr);\n  max-width: 300px;\n}\n.north-luna-moments-image-grid.four {\n  grid-template-columns: repeat(2, 1fr);\n  max-width: 300px;\n}\n.north-luna-moments-image-grid.nine {\n  grid-template-columns: repeat(3, 1fr);\n  max-width: 300px;\n}\n.north-luna-moments-grid-img {\n  width: 100%;\n  aspect-ratio: 1;\n  object-fit: cover;\n  display: block;\n  cursor: zoom-in;\n  background: var(--b3-theme-surface);\n  transition: transform 0.3s ease;\n  border-radius: 8px;\n}\n.north-luna-moments-image-grid.single .north-luna-moments-grid-img {\n  aspect-ratio: auto;\n  max-height: 280px;\n  width: auto;\n  max-width: 100%;\n  border-radius: 6px;\n}\n.north-luna-moments-link-card {\n  display: flex;\n  align-items: center;\n  background-color: var(--moments-link-card-bg);\n  padding: 8px;\n  border-radius: 4px;\n  margin-bottom: 8px;\n  max-width: 220px;\n}\n.north-luna-moments-link-thumb {\n  width: 40px;\n  height: 40px;\n  border-radius: 4px;\n  object-fit: cover;\n  margin-right: 8px;\n  flex-shrink: 0;\n  background-color: #e0e0e0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n.north-luna-moments-link-info {\n  flex: 1;\n  min-width: 0;\n}\n.north-luna-moments-link-title {\n  font-size: 13px;\n  color: var(--moments-text);\n  line-height: 1.4;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n}\n.north-luna-moments-link-url {\n  font-size: 11px;\n  color: var(--moments-close-color);\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.north-luna-moments-item-meta {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  margin-top: 10px;\n  gap: 8px;\n  flex-wrap: nowrap;\n}\n.north-luna-moments-meta-tags {\n  display: flex;\n  align-items: center;\n  flex-wrap: wrap;\n  gap: 0;\n  flex: 1;\n  min-width: 0;\n  overflow: hidden;\n}\n.north-luna-moments-meta-item {\n  display: inline-flex;\n  align-items: center;\n  gap: 2px;\n  font-size: 12px;\n  color: var(--moments-text-secondary);\n  white-space: nowrap;\n  flex-shrink: 0;\n  line-height: 1.5;\n}\n.north-luna-moments-meta-item + .north-luna-moments-meta-item::before {\n  content: \"\\b7\";\n  margin: 0 7px;\n  color: var(--moments-text-secondary);\n  opacity: 0.4;\n  font-weight: bold;\n}\n.north-luna-moments-item-actions {\n  display: flex;\n  align-items: center;\n  justify-content: flex-start;\n  gap: 12px;\n  position: relative;\n  margin-top: 6px;\n}\n.north-luna-moments-liked-indicator {\n  display: inline-flex;\n  align-items: center;\n  flex-shrink: 0;\n  animation: moments-like-pop 0.3s ease;\n}\n.north-luna-moments-liked-indicator svg {\n  display: block;\n}\n@keyframes moments-like-pop {\n  0% {\n    transform: scale(1);\n  }\n  50% {\n    transform: scale(1.3);\n  }\n  100% {\n    transform: scale(1);\n  }\n}\n.north-luna-moments-pin-badge {\n  position: absolute;\n  top: 12px;\n  right: 12px;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  color: var(--b3-theme-primary);\n  opacity: 0.6;\n  pointer-events: none;\n}\n.north-luna-moments-more-btn {\n  width: 28px;\n  height: 24px;\n  background-color: transparent;\n  border: none;\n  border-radius: 6px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n  position: relative;\n  opacity: 0;\n  transition: opacity 0.2s ease, background-color 0.2s ease;\n}\n.north-luna-moments-item:hover .north-luna-moments-more-btn {\n  opacity: 1;\n}\n.north-luna-moments-more-btn:hover {\n  background-color: var(--moments-interaction-bg);\n}\n.north-luna-moments-more-btn::before {\n  content: \"\\22ef\";\n  font-size: 14px;\n  line-height: 1;\n  color: var(--moments-close-color);\n  letter-spacing: 1px;\n}\n.north-luna-moments-action-popup {\n  position: absolute;\n  right: 40px;\n  top: 50%;\n  transform: translateY(-50%);\n  background-color: var(--moments-action-popup-bg);\n  border: 1px solid var(--b3-border-color);\n  border-radius: 8px;\n  padding: 4px;\n  display: none;\n  flex-direction: column;\n  gap: 2px;\n  z-index: 10;\n  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.24);\n}\n.north-luna-moments-action-popup[data-mid] {\n  display: none;\n}\n.north-luna-moments-item.popup-open .north-luna-moments-action-popup {\n  display: flex;\n}\n.north-luna-moments-action-popup-row {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 2px;\n}\n.north-luna-moments-action-popup-btn {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  padding: 6px 10px;\n  font-size: 13px;\n  color: var(--moments-action-popup-text);\n  white-space: nowrap;\n  cursor: pointer;\n  border-radius: 6px;\n}\n.north-luna-moments-action-popup-btn:hover {\n  background-color: var(--moments-action-popup-active-bg);\n}\n.north-luna-moments-action-popup-btn:active {\n  background-color: var(--moments-action-popup-active-bg);\n}\n.north-luna-moments-action-popup-btn.like-btn.liked {\n  color: #e74c3c;\n}\n.north-luna-moments-action-popup-btn.like-btn.liked svg {\n  animation: moments-like-pop 0.3s ease;\n}\n.north-luna-moments-comment-panel {\n  margin-top: 8px;\n  padding: 8px 0 0;\n  animation: moments-likes-fade-in 0.2s ease;\n}\n.north-luna-moments-comment-panel:has(.north-luna-moments-comment-item) {\n  border-top: 1px solid rgba(128, 128, 128, 0.08);\n}\n.north-luna-moments-comment-item {\n  padding: 4px 0;\n  font-size: 13px;\n  line-height: 1.5;\n}\n.north-luna-moments-comment-display {\n  display: block;\n}\n.north-luna-moments-comment-text {\n  color: var(--b3-theme-on-surface);\n  word-break: break-all;\n  user-select: text;\n}\n.north-luna-moments-comment-text strong {\n  color: var(--b3-theme-primary);\n  font-weight: 600;\n}\n.north-luna-moments-comment-actions {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  margin-top: 4px;\n}\n.north-luna-moments-comment-actions-right {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n}\n.north-luna-moments-comment-time {\n  font-size: 11px;\n  color: var(--b3-theme-on-surface-light);\n  white-space: nowrap;\n}\n.north-luna-moments-comment-del {\n  display: inline-flex;\n  border: none;\n  background: transparent;\n  color: var(--b3-theme-on-surface-light);\n  cursor: pointer;\n  opacity: 0;\n  padding: 2px;\n  transition: opacity 0.15s;\n}\n.north-luna-moments-comment-item:hover .north-luna-moments-comment-del {\n  opacity: 1;\n}\n.north-luna-moments-comment-del:hover {\n  color: var(--b3-theme-on-surface);\n}\n.north-luna-moments-comment-input-row {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin-top: 8px;\n  padding-top: 6px;\n}\n.north-luna-moments-comment-input {\n  flex: 1;\n  border: none;\n  outline: none;\n  background: var(--b3-theme-surface);\n  border-radius: 7px;\n  padding: 6px 12px;\n  font-size: 13px;\n  color: var(--b3-theme-on-surface);\n  line-height: 1.4;\n}\n.north-luna-moments-comment-input::placeholder {\n  color: var(--b3-theme-on-surface-light);\n}\n.north-luna-moments-comment-panel .north-luna-moments-comment-send {\n  flex-shrink: 0;\n  border: none;\n  background: var(--b3-theme-primary);\n  color: #fff;\n  border-radius: 7px;\n  padding: 6px 18px;\n  min-width: 56px;\n  font-size: 13px;\n  font-weight: 600;\n  line-height: 1.3;\n  cursor: pointer;\n  transition: opacity 0.15s;\n  text-align: center;\n  white-space: nowrap;\n}\n.north-luna-moments-comment-panel .north-luna-moments-comment-send:hover {\n  opacity: 0.85;\n}\n@keyframes moments-likes-fade-in {\n  from {\n    opacity: 0;\n    transform: translateY(-4px);\n  }\n  to {\n    opacity: 1;\n    transform: translateY(0);\n  }\n}\n.north-luna-moments-item.mom-flash {\n  animation: mom-flash 1.6s ease;\n}\n.mom-list .north-luna-moments-date-group {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 10px;\n  margin: 4px 0 10px;\n  width: 100%;\n  box-sizing: border-box;\n}\n.mom-list .north-luna-moments-date-group::before,\n.mom-list .north-luna-moments-date-group::after {\n  content: \"\";\n  flex: 1;\n  height: 1px;\n  max-width: 90px;\n  background:\n    linear-gradient(\n      to right,\n      transparent,\n      color-mix(in srgb, var(--b3-theme-on-surface) 22%, transparent));\n}\n.mom-list .north-luna-moments-date-group::after {\n  background:\n    linear-gradient(\n      to left,\n      transparent,\n      color-mix(in srgb, var(--b3-theme-on-surface) 22%, transparent));\n}\n.mom-list .north-luna-moments-date-group-text {\n  font-size: 20px;\n  font-weight: 600;\n  color: var(--b3-theme-on-background);\n  letter-spacing: 0.4px;\n  white-space: nowrap;\n}\n.north-luna-moments-outline-popover {\n  width: 140px;\n  max-height: 320px;\n  overflow-y: auto;\n  background: var(--b3-theme-surface);\n  border: 1px solid var(--b3-border-color);\n  border-radius: 10px;\n  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);\n  z-index: 100;\n  padding: 6px 0;\n}\n.north-luna-moments-outline-title {\n  font-size: 12px;\n  font-weight: 600;\n  color: var(--b3-theme-on-surface-light);\n  padding: 6px 14px 8px;\n  border-bottom: 0.5px solid var(--b3-border-color);\n  margin-bottom: 4px;\n}\n.north-luna-moments-outline-item {\n  font-size: 14px;\n  color: var(--b3-theme-on-background);\n  padding: 8px 14px;\n  cursor: pointer;\n  transition: background 0.12s ease, color 0.12s ease;\n}\n.north-luna-moments-outline-item:hover {\n  background: var(--b3-list-hover);\n}\n.north-luna-moments-outline-item.active {\n  color: var(--b3-theme-primary);\n  font-weight: 600;\n  background: var(--b3-theme-primary-lightest);\n}\n\n/* 方案3：去掉\"⋯\"按钮，动态下方悬停淡入一行操作图标 */\n.north-luna-moments-more-btn,\n.north-luna-moments-action-popup {\n  display: none !important;\n}\n.north-luna-moments-action-bar {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n}\n.north-luna-moments-action-btn {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 31px;\n  height: 31px;\n  border: none;\n  border-radius: 7px;\n  background: transparent;\n  color: var(--b3-theme-on-surface-light);\n  cursor: pointer;\n  transition: background-color .15s ease, color .15s ease;\n}\n.north-luna-moments-action-btn svg {\n  width: 16px !important;\n  height: 16px !important;\n}\n.north-luna-moments-action-btn:hover,\n.north-luna-moments-action-btn:focus-visible {\n  background-color: var(--b3-theme-background-light);\n  color: var(--b3-theme-on-background);\n}\n.north-luna-moments-action-btn:focus-visible {\n  outline: 2px solid var(--b3-theme-primary, #4e6ef2);\n  outline-offset: 1px;\n}\n.north-luna-moments-action-btn.like-action.liked {\n  color: #e74c3c;\n}\n.north-luna-moments-action-btn.active {\n  color: var(--b3-theme-primary);\n}\n.north-luna-moments-action-btn.north-luna-moments-action-del {\n  color: #e05050;\n}\n.north-luna-moments-action-btn.north-luna-moments-action-del:hover {\n  color: #e05050;\n  background-color: #fdecec;\n}\n/* ===== 移动端：卡片尽量充满屏幕 ===== */\n@media (max-width: 480px) {\n  .north-luna-moments-item {\n    width: calc(100% - 6%);\n    margin: 0 auto;\n    padding: 12px;\n  }\n}\n\n/* ===== Orca Note adaptation (appended by build.mjs) ===== */\n.orca-df-host { height: 100%; min-height: 0; }\n.orca-df-scope .mom-root { height: 100%; }\n.orca-df-scope {\n  --b3-theme-background: #f5f6f8;\n  --b3-theme-background-light: rgba(255,255,255,0.78);\n  --b3-theme-on-background: #24292f;\n  --b3-theme-primary: #3575f0;\n  --b3-theme-primary-light: #6a95f4;\n  --b3-theme-primary-lighter: #e2ecfd;\n  --b3-theme-primary-lightest: #f0f5fe;\n  --b3-border-color: #e5e7eb;\n  --b3-theme-surface: #ffffff;\n  --b3-theme-surface-lighter: #f0f1f4;\n  --b3-theme-on-surface: #24292f;\n  --b3-theme-on-surface-light: #6b7280;\n  --b3-list-hover: #eceef2;\n  --b3-font-family-code: ui-monospace, \"Cascadia Code\", Consolas, \"Courier New\", monospace;\n  color: var(--b3-theme-on-background);\n}\n.orca-df-scope.orca-df-dark {\n  --b3-theme-background: #1b1e24;\n  --b3-theme-background-light: rgba(30,33,40,0.78);\n  --b3-theme-on-background: #d7dde5;\n  --b3-theme-primary: #4c88ff;\n  --b3-theme-primary-light: #7aa7ff;\n  --b3-theme-primary-lighter: #263650;\n  --b3-theme-primary-lightest: #1f2c42;\n  --b3-border-color: #363b45;\n  --b3-theme-surface: #242830;\n  --b3-theme-surface-lighter: #2c313b;\n  --b3-theme-on-surface: #d7dde5;\n  --b3-theme-on-surface-light: #9aa3af;\n  --b3-list-hover: #2c313b;\n}\n.orca-df-hb-icon { display: inline-flex; align-items: center; justify-content: center; }\n.orca-df-hb-icon svg { display: block; }\n/* ---- 标签功能 ---- */\n.north-luna-moments-tags { display: flex; flex-wrap: wrap; gap: 6px 8px; margin-top: 10px; }\n.north-luna-moments-tag { font-size: 12px; line-height: 1.6; color: var(--b3-theme-primary); background: var(--b3-theme-primary-lightest); padding: 1px 9px; border-radius: 9px; cursor: pointer; user-select: none; transition: background 0.15s; }\n.north-luna-moments-tag:hover { background: var(--b3-theme-primary-lighter); }\n.mom-publish-info { flex-wrap: wrap; }\n.mom-publish-info .mom-publish-info-tags { flex: 1 1 100%; min-width: 0; margin-top: 4px; }\n/* ---- 空状态美化 ---- */\n.mom-empty { padding: 60px 24px 48px; text-align: center; }\n.mom-empty-ico { font-size: 46px; line-height: 1; margin-bottom: 16px; opacity: 0.85; }\n.mom-empty-title { font-size: 16px; font-weight: 600; margin: 0 0 8px; color: var(--b3-theme-on-surface, #24292f); }\n.mom-empty-sub { font-size: 13px; line-height: 1.7; margin: 0 0 6px; color: var(--b3-theme-on-surface-light, #6b7280); }\n.mom-empty-hint { font-size: 12px; line-height: 1.7; margin: 0 0 20px; color: var(--b3-theme-on-surface-light, #6b7280); opacity: 0.8; }\n.mom-empty-btn { margin-top: 4px; }\n/* ---- 内容占满面板（适配宽面板，覆盖思源窄栏 73%/居中限制） ---- */\n.orca-df-scope .mom-list { align-items: stretch; padding-left: 16px; padding-right: 16px; }\n.orca-df-scope .mom-filter-bar, .orca-df-scope .mom-pin-strip { width: 100%; }\n.orca-df-scope .north-luna-moments-item { width: 100%; }";

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
