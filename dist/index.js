// orca-diaryflow v0.3.19 — light compose + Orca blocks (plan C)
// Orca Note adaptation: panel, plugin-file media, block store, tags/refs/search
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
      return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
      if (avatar) {
        const resolved = globalThis.__DF_ASSETS ? globalThis.__DF_ASSETS.resolve(avatar) : avatar;
        const blank = !resolved
          || resolved === "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
          || (typeof resolved === "string" && resolved.indexOf("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP") === 0);
        if (!blank) return `<img class="mom-avatar" src="${esc(resolved)}" alt="" decoding="async">`;
      }
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
      if (name === "label") return `<svg viewBox="0 0 24 24" ${dim}><path d="M17.63 5.84C17.27 5.33 16.67 5 16 5H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h11c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"></path></svg>`;
      if (name === "heart") return `<svg viewBox="0 0 24 24" ${dim}><path fill="#e74c3c" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>`;
      const d = ICONS[name] || name;
      return `<svg viewBox="0 0 24 24" ${dim}><path d="${d}"></path></svg>`;
    }
    function dateStr(it) {
      const d = new Date(toTs(it));
      return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    }
    function coverHtml(cfg, items) {
      const coverSrc = cfg.cover ? (globalThis.__DF_ASSETS ? globalThis.__DF_ASSETS.resolve(cfg.cover) : cfg.cover) : "";
      const cover = coverSrc ? `<img class="mom-cover-img" data-cover-img src="${esc(coverSrc)}" alt="cover" loading="lazy" decoding="async" fetchpriority="low">` : `<div class="mom-cover-default" data-cover-img></div>`;
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
        <div class="mom-cover-signature">${esc(cfg.signature || "")}</div>
        <span class="mom-cover-stats">${stats}</span>
        <div class="mom-cover-actions">
          <button class="mom-cover-settings mom-cover-cal" data-act="calendar" title="\u65E5\u8BB0\u6D41\u65E5\u5386">${ico("calendar", 18)}</button>
          <button class="mom-cover-settings" data-action="open-settings" title="\u65E5\u8BB0\u6D41\u8BBE\u7F6E">${ico("settings", 18)}</button>
        </div>
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
        <div class="mom-signature" hidden>
          <div class="mom-signature-tools" hidden></div>
        </div>
        ${renderPinnedStrip(ctx)}
        <main class="mom-list" data-list></main>
        <div class="mom-bottom-space"></div>
      </div>
      <div class="mom-fab-stack${ctx.plugin && ctx.plugin.isMobile ? " is-mobile" : ""}">
        <button class="mom-outline-fab mom-tag-fab" data-action="open-tag-filter" title="\u6807\u7B7E\u7B5B\u9009">${ico("label", 18)}</button>
        <button class="mom-outline-fab" data-action="open-outline" title="\u6708\u4EFD\u5927\u7EB2">${ico("outline", 18)}</button>
        <button class="mom-outline-fab" data-action="open-editor" title="\u5728\u864E\u9CB8\u4E2D\u65B0\u5EFA">${ico("edit", 18)}</button>
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
          const raw0 = String(m.text || "\u7F6E\u9876");
          const raw = raw0.split(/\r?\n/).map((s) => s.trim()).find((s) => s) || "\u7F6E\u9876";
          const preview = raw.length > 28 ? raw.slice(0, 28) + "\u2026" : raw;
          return `<button type="button" class="mom-pin-group mom-pin-group-text" data-action="jump-mid" data-id="${id}" title="${esc(preview)}">
        <span class="mom-pin-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg></span>
        <span class="mom-pin-title">${esc(preview)}</span>
      </button>`;
        }
        const single = imgs.length <= 1;
        const cols = getCols(imgs.length);
        const size = single ? 40 : 28;
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
        return `<button type="button" class="mom-pin-group mom-pin-group-media" data-action="jump-mid" data-id="${id}" style="grid-template-columns:repeat(${cols},${size}px)">${cells}</button>`;
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
          : `<div class="mom-empty"><div class="mom-empty-ico">\u{1F4CB}</div><p class="mom-empty-title">\u8FD8\u6CA1\u6709\u52A8\u6001</p><p class="mom-empty-sub">\u8BB0\u5F55\u4E0B\u8FD9\u4E00\u523B\uFF0C\u8BA9\u65E5\u5B50\u53EF\u4EE5\u56DE\u5934\u3002</p><p class="mom-empty-hint">\u5728\u864E\u9CB8\u65E5\u8BB0\u91CC\u7F16\u8F91\u6587\u5B57\u3001\u56FE\u7247\u4E0E\u6807\u7B7E \u2022 \u70B9\u4E0B\u65B9\u6309\u94AE\u65B0\u5EFA\u5E76\u6253\u5F00</p><button class="mom-btn mom-btn-primary mom-empty-btn" data-action="open-editor" type="button">\uFF0B \u5728\u864E\u9CB8\u4E2D\u5199</button>
</div>`;
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
      return `
    <div class="north-luna-moments-item-actions">
      <div class="north-luna-moments-action-bar">
        <button class="north-luna-moments-action-btn" data-mid="${mid}" data-id="${mid}" data-action="toggle-comments" title="\u8BC4\u8BBA" aria-label="\u8BC4\u8BBA"><svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M12 3c-5 0-9 3.6-9 8 0 2.5 1.3 4.7 3.4 6.1L5.5 21l4.3-2.3c.7.2 1.4.3 2.2.3 5 0 9-3.6 9-8s-4-8-9-8z"></path></svg></button>
        <button class="north-luna-moments-action-btn" data-mid="${mid}" data-id="${mid}" data-action="edit" title="\u5728\u864E\u9CB8\u4E2D\u7F16\u8F91" aria-label="\u5728\u864E\u9CB8\u4E2D\u7F16\u8F91">${ico("edit", 15)}</button>
        <button class="north-luna-moments-action-btn" data-mid="${mid}" data-id="${mid}" data-action="time" title="\u4FEE\u6539\u65F6\u95F4" aria-label="\u4FEE\u6539\u65F6\u95F4">${ico("clock", 15)}</button>
        <button type="button" class="north-luna-moments-action-btn orca-df-more-btn" data-mid="${mid}" data-id="${mid}" data-action="more" title="\u66F4\u591A" aria-label="\u66F4\u591A" aria-haspopup="menu"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path></svg></button>
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
      const all = (it.images || []).filter(Boolean);
      let html = "";
      if (all.length) {
        const total = all.length;
        const items = all.slice(0, 9);
        const extra = total > 9 ? total - 9 : 0;
        // 4 张及以上统一九宫格（3 列）；超出 9 张时第 9 格叠 +N
        const gridClass = items.length === 1 ? "single" : items.length === 2 ? "double" : items.length === 3 ? "triple" : "nine";
        const cells = items.map((src, i) => {
          const more = extra > 0 && i === items.length - 1;
          if (isVideoSrc(src)) {
            const inner = `<video class="north-luna-moments-grid-video-el" src="${esc(src)}#t=0.1" data-vthumb="${esc(src)}" muted playsinline preload="metadata"></video><span class="north-luna-moments-grid-play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>${more ? `<span class="north-luna-moments-grid-more-badge">+${extra}</span>` : ""}`;
            return `<div class="north-luna-moments-grid-cel north-luna-moments-grid-video${more ? " north-luna-moments-grid-more" : ""}" data-action="play-vid" data-src="${esc(src)}" data-idx="${i}" title="${more ? `\u8FD8\u6709 ${extra} \u9879` : "\u64AD\u653E\u89C6\u9891"}">${inner}</div>`;
          }
          if (more) {
            return `<div class="north-luna-moments-grid-cel north-luna-moments-grid-more" data-action="show-img" data-src="${esc(src)}" data-idx="${i}" title="\u8FD8\u6709 ${extra} \u9879"><img class="north-luna-moments-grid-img" src="${esc(src)}" data-kind="image" alt="media" loading="lazy" decoding="async"><span class="north-luna-moments-grid-more-badge">+${extra}</span></div>`;
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
      let raw = it.text || "";
      try {
        const OB = globalThis.__DF_ORCA_BLOCKS;
        if (OB && typeof OB.stripInlineTagText === "function") {
          raw = OB.stripInlineTagText(raw, it.tags || []);
        } else {
          raw = String(raw).replace(/\uFF03/g, "#").replace(/#[^\s#，,、]+/g, "").replace(/[\s]*[,，、]+[\s]*/g, " ").trim();
        }
      } catch (e) {
        raw = String(raw).replace(/\uFF03/g, "#").replace(/#[^\s#，,、]+/g, "").replace(/[\s]*[,，、]+[\s]*/g, " ").trim();
      }
      const body = renderFeedMd(raw);
      return `<div class="north-luna-moments-item-text">${body || '<span class="north-luna-moments-no-text">[\u65E0\u6587\u5B57]</span>'}</div>`;
    }
    function renderFeedMd(raw) {
      const lines = String(raw || "").replace(/\r\n/g, "\n").split("\n");
      let html = "";
      let i = 0;
      const stack = [];
      const listRe = /^(\s*)([-*+]|\d+\.)\s+(.*)$/;
      const closeTo = (depth) => {
        while (stack.length && stack[stack.length - 1].depth > depth) {
          html += stack.pop().ordered ? "</ol>" : "</ul>";
        }
      };
      while (i < lines.length) {
        const line = lines[i];
        if (/^```/.test(line)) {
          closeTo(-1);
          const code = [];
          i++;
          while (i < lines.length && !/^```/.test(lines[i])) {
            code.push(esc(lines[i]));
            i++;
          }
          if (i < lines.length) i++;
          html += `<pre class="orca-df-md-code"><code>${code.join("\n")}</code></pre>`;
          continue;
        }
        const hm = line.match(/^(#{1,6})\s+(.*)$/);
        if (hm) {
          closeTo(-1);
          html += `<div class="orca-df-md-h orca-df-md-h${hm[1].length}">${renderInlineMd(hm[2])}</div>`;
          i++;
          continue;
        }
        if (/^>\s?/.test(line)) {
          closeTo(-1);
          html += `<blockquote class="orca-df-md-quote">${renderInlineMd(line.replace(/^>\s?/, ""))}</blockquote>`;
          i++;
          continue;
        }
        const lm = line.match(listRe);
        if (lm) {
          const depth = Math.floor(String(lm[1] || "").replace(/\t/g, "  ").length / 2);
          const ordered = /^\d+\./.test(lm[2]);
          closeTo(depth);
          const top = stack[stack.length - 1];
          if (!top || top.depth < depth) {
            html += ordered ? `<ol class="orca-df-md-ol">` : `<ul class="orca-df-md-ul">`;
            stack.push({ depth, ordered });
          } else if (top.depth === depth && top.ordered !== ordered) {
            html += stack.pop().ordered ? "</ol>" : "</ul>";
            html += ordered ? `<ol class="orca-df-md-ol">` : `<ul class="orca-df-md-ul">`;
            stack.push({ depth, ordered });
          }
          html += `<li class="orca-df-md-li">${renderInlineMd(lm[3])}</li>`;
          i++;
          continue;
        }
        closeTo(-1);
        if (!String(line).trim()) html += `<div class="orca-df-md-gap"></div>`;
        else html += `<div class="orca-df-md-p">${renderInlineMd(line)}</div>`;
        i++;
      }
      closeTo(-1);
      return html;
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
      s = s.replace(/__([^_\n]+)__/g, "<u>$1</u>");
      s = s.replace(/\[([^\]\n]+)\]\(dfref:(\d+)\)/g, '<a class="mom-md-link orca-df-inline-ref" href="#" data-df-act="goto-ref" data-block-id="$2">$1</a>');
      s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a class="mom-md-link" href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      s = s.replace(/\u0000COLOR\u0000/g, (m, i) => {
        const p = colorPlaces.shift() || { c: "", txt: "" };
        const safeTxt = esc(p.txt);
        if (!/^[#\w(),.\s%-]+$/.test(p.c)) return safeTxt;
        return `<span style="color:${esc(p.c)}">${safeTxt}</span>`;
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
      const monthNames = dfCalMonthsShort();
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
              const tip = dfCalTip(m2, date.getDate(), count);
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
        return `<div class="mom-calendar-photo-month"><div class="mom-calendar-photo-month-title">${dfCalMonthTitle(year, m2)}</div><div class="mom-calendar-photo-grid">${grid}</div></div>`;
      };
      return `<div class="mom-calendar-photo-twocol">${Array.from({ length: 12 }, (_, i) => renderMonth(i)).join("")}</div>`;
    }
    // 热力图模式：上半年 / 下半年两行周视图（窄屏友好，GitHub 式色阶）
    function calBuildHeat(ctx, year) {
      const { dayCounts } = calGridStats(ctx, year);
      const monthNames = dfCalMonthsShort();
      const startDate = calStartDate(year);
      const weeks = calWeeks(year, startDate);
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
      const heatLevel = (count) => {
        if (count >= 5) return 4;
        if (count >= 3) return 3;
        if (count >= 2) return 2;
        if (count >= 1) return 1;
        return 0;
      };
      const buildHalf = (m0, m1, caption) => {
        let w0 = Infinity;
        let w1 = -1;
        for (let m2 = m0; m2 <= m1; m2++) {
          if (msW[m2] !== -1) {
            w0 = Math.min(w0, msW[m2]);
            w1 = Math.max(w1, meW[m2]);
          }
        }
        if (!isFinite(w0) || w1 < 0) {
          return `<div class="mom-calendar-heat-half"><div class="mom-calendar-heat-caption">${caption}</div><div class="mom-calendar-heat-empty">${dfT("暂无记录")}</div></div>`;
        }
        let columns = "";
        for (let w = w0; w <= w1; w++) {
          let cells = "";
          for (let d = 0; d < 7; d++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + w * 7 + d);
            const inHalf = date.getFullYear() === year && date.getMonth() >= m0 && date.getMonth() <= m1;
            if (inHalf) {
              const key = `${date.getFullYear()}-${p2(date.getMonth() + 1)}-${p2(date.getDate())}`;
              const count = dayCounts[key] || 0;
              const level = heatLevel(count);
              const tip = dfCalTip(date.getMonth(), date.getDate(), count);
              const dateAttr = count > 0 ? ` data-date="${key}"` : "";
              cells += `<div class="mom-calendar-cell level-${level}"${dateAttr} title="${tip}"></div>`;
            } else {
              cells += `<div class="mom-calendar-cell level-empty"></div>`;
            }
          }
          columns += `<div class="mom-calendar-column">${cells}</div>`;
        }
        const halfWeeks = w1 - w0 + 1;
        const labels = [];
        for (let m2 = m0; m2 <= m1; m2++) {
          if (msW[m2] === -1) continue;
          const mid = (msW[m2] + meW[m2]) / 2;
          const left = (mid - w0 + 0.5) / halfWeeks * 100;
          labels.push(`<span class="mom-calendar-month-label" style="left:${left}%">${monthNames[m2]}</span>`);
        }
        return `<div class="mom-calendar-heat-half"><div class="mom-calendar-heat-caption">${caption}</div><div class="mom-calendar-columns">${columns}</div><div class="mom-calendar-months">${labels.join("")}</div></div>`;
      };
      return `<div class="mom-calendar-heat-wrap">${buildHalf(0, 5, dfT("上半年"))}${buildHalf(6, 11, dfT("下半年"))}</div>`;
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
            <span>${dfT("日历")}</span>
            <select class="mom-calendar-year" data-cal-year></select>
            <span class="mom-calendar-modes">
              <button class="mom-calendar-mode${ctx.calMode === "photo" ? " on" : ""}" data-cal-mode="photo">${dfT("照片")}</button>
              <button class="mom-calendar-mode${ctx.calMode === "heatmap" ? " on" : ""}" data-cal-mode="heatmap">${dfT("热度")}</button>
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
      yearSel.innerHTML = sortedYears.map((y) => `<option value="${y}"${y === ctx.calYear ? " selected" : ""}>${dfLocaleIsEn() ? y : y + "年"}</option>`).join("");
      const applyWidth = (mode) => {
        // 热度必须设明确 width：仅 maxWidth + auto 会收缩，界面看起来「没变化」
        if (mode === "heatmap") {
          const w = Math.min(680, Math.floor(window.innerWidth * 0.96));
          content.style.width = w + "px";
          content.style.maxWidth = w + "px";
        } else {
          // 照片模式：加宽以两列并排显示两个月
          content.style.width = "94%";
          content.style.maxWidth = "880px";
        }
      };
      const scrollCurMonth = () => {
        if (ctx.calMode !== "photo") return;
        const now = /* @__PURE__ */ new Date();
        const targetTitle = dfCalMonthTitle(now.getFullYear(), now.getMonth());
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
        countEl.textContent = items.filter((it) => new Date(toTs(it)).getFullYear() === year).length + (dfLocaleIsEn() ? " entries" : " 条记录");
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
    function dfImageExtOf(file) {
      const m = file && file.name && String(file.name).match(/\.([a-z0-9]+)$/i);
      if (m) return m[1].toLowerCase();
      const t = String((file && file.type) || "").toLowerCase();
      if (t === "image/jpeg" || t === "image/jpg") return "jpg";
      if (t === "image/png") return "png";
      if (t === "image/webp") return "webp";
      if (t === "image/gif") return "gif";
      if (t === "image/bmp") return "bmp";
      return "jpg";
    }
    function dfIsUnsupportedImage(file) {
      const t = String((file && file.type) || "").toLowerCase();
      const n = String((file && file.name) || "").toLowerCase();
      if (t.includes("heic") || t.includes("heif") || /\.heic$|\.heif$/i.test(n)) return "HEIC/HEIF";
      if (t.includes("tiff") || /\.tiff?$/i.test(n)) return "TIFF";
      return "";
    }
    /** 解码并压成 JPG/PNG；头像建议 maxDim=512。失败抛错（不再静默回传原文件） */
    function compressImage(file, maxDim, quality) {
      maxDim = maxDim || 1920;
      quality = quality == null ? 0.85 : quality;
      return new Promise((resolve, reject) => {
        const bad = dfIsUnsupportedImage(file);
        if (bad) {
          reject(new Error(dfT("\u6682\u4E0D\u652F\u6301 ") + bad + dfT("\uFF0C\u8BF7\u5148\u8F6C\u4E3A JPG/PNG/WebP")));
          return;
        }
        const type = String((file && file.type) || "").toLowerCase();
        if (type === "image/svg+xml" || /\.svg$/i.test(file && file.name || "")) {
          reject(new Error(dfT("\u6682\u4E0D\u652F\u6301 SVG \u4F5C\u4E3A\u5934\u50CF/\u5C01\u9762\uFF0C\u8BF7\u7528 JPG/PNG")));
          return;
        }
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          let w = img.naturalWidth || img.width || 0;
          let h = img.naturalHeight || img.height || 0;
          if (!w || !h) {
            reject(new Error(dfT("\u56FE\u7247\u5C3A\u5BF8\u65E0\u6548\uFF0C\u8BF7\u6362\u4E00\u5F20 JPG/PNG")));
            return;
          }
          const scale = Math.min(1, maxDim / Math.max(w, h, 1));
          w = Math.max(1, Math.round(w * scale));
          h = Math.max(1, Math.round(h * scale));
          let canvas;
          try {
            canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx2d = canvas.getContext("2d");
            if (!ctx2d) throw new Error("no 2d");
            // 透明 PNG 铺白底再出 JPG，避免黑底
            if (type !== "image/png") {
              ctx2d.fillStyle = "#fff";
              ctx2d.fillRect(0, 0, w, h);
            }
            ctx2d.drawImage(img, 0, 0, w, h);
          } catch (eDraw) {
            reject(new Error(dfT("\u56FE\u7247\u8FC7\u5927\u6216\u65E0\u6CD5\u89E3\u7801\uFF0C\u8BF7\u538B\u7F29\u540E\u91CD\u8BD5")));
            return;
          }
          // 统一出 JPEG（兼容性最好）；原图为 PNG 且不太大时保留 PNG
          const keepPng = type === "image/png" && file.size < 2 * 1024 * 1024 && maxDim <= 1024;
          const outType = keepPng ? "image/png" : "image/jpeg";
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error(dfT("\u56FE\u7247\u8F6C\u7801\u5931\u8D25\uFF0C\u8BF7\u6362 JPG/PNG \u91CD\u8BD5")));
              return;
            }
            const ext = outType === "image/png" ? "png" : "jpg";
            const base = String((file && file.name) || "image").replace(/\.[^.]+$/, "") || "image";
            resolve(new File([blob], base + "." + ext, { type: outType }));
          }, outType, quality);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error(dfT("\u65E0\u6CD5\u8BFB\u53D6\u8BE5\u56FE\u7247\uFF08\u683C\u5F0F\u4E0D\u652F\u6301\u6216\u5DF2\u635F\u574F\uFF09\uFF0C\u8BF7\u7528 JPG/PNG/WebP")));
        };
        img.src = url;
      });
    }
    async function uploadDiaryflowFile(file) {
      const ext = dfImageExtOf(file);
      const name = `df_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      // 优先写入当前仓库 assets（换库/重载后仍可 file:// 展示）
      try {
        const buf = await file.arrayBuffer();
        let mime = (file.type && String(file.type)) || "";
        if (!mime || mime === "application/octet-stream") {
          mime = ext === "png" ? "image/png"
            : ext === "webp" ? "image/webp"
            : ext === "gif" ? "image/gif"
            : "image/jpeg";
        }
        const uploaded = await orca.invokeBackend("upload-asset-binary", mime, buf);
        if (uploaded) return uploaded;
      } catch (e0) {
        console.warn("[orca-diaryflow] upload-asset-binary failed, fallback dfasset", e0);
      }
      try {
        return await globalThis.__DF_ASSETS.save(file, name);
      } catch (e) {
        console.error("[orca-diaryflow] asset save failed", e);
      }
      return null;
    }
    async function saveImageToAssets(file, opts) {
      opts = opts || {};
      const maxDim = opts.maxDim || 1920;
      const quality = opts.quality == null ? 0.85 : opts.quality;
      const compressed = await compressImage(file, maxDim, quality);
      const uploaded = await uploadDiaryflowFile(compressed);
      if (uploaded) return uploaded;
      return readAsDataURL(compressed);
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
        img.src = globalThis.__DF_ASSETS ? globalThis.__DF_ASSETS.resolve(url) : url;
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
      input.accept = "image/jpeg,image/png,image/webp,image/gif,image/bmp,.jpg,.jpeg,.png,.webp,.gif,.bmp";
      input.onchange = async () => {
        const f = (input.files || [])[0];
        if (input.parentNode) input.remove();
        if (!f) return;
        ctx.showMessage && ctx.showMessage("\u5C01\u9762\u4E0A\u4F20\u4E2D\u2026");
        try {
          const path = await uploadAsset(f);
          if (!path) {
            ctx.showMessage && ctx.showMessage("\u5C01\u9762\u4E0A\u4F20\u5931\u8D25");
            return;
          }
          setCover(ctx, path);
        } catch (e) {
          console.warn("[orca-diaryflow] cover upload", e);
          ctx.showMessage && ctx.showMessage((e && e.message) || "\u5C01\u9762\u4E0D\u652F\u6301\u8BE5\u683C\u5F0F");
        }
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
        if (!files.length) return;
        if (d.images.length + files.length > 9) {
          ctx.showMessage("\u6700\u591A 9 \u9879\u56FE\u7247/\u89C6\u9891");
          return;
        }
        files.forEach((file) => {
          const isVid = file.type && file.type.startsWith("video/");
          let localUrl = "";
          try {
            localUrl = URL.createObjectURL(file);
          } catch (err) {
            localUrl = "";
          }
          if (localUrl) {
            d.images.push(localUrl);
            renderImgs();
          }
          const proceed = (src) => {
            if (localUrl) {
              const idx = d.images.indexOf(localUrl);
              if (src && src !== localUrl) {
                if (idx >= 0) d.images[idx] = src;
                else d.images.push(src);
                try {
                  URL.revokeObjectURL(localUrl);
                } catch (e2) {
                }
              } else if (!src && idx >= 0) {
                d.images.splice(idx, 1);
                try {
                  URL.revokeObjectURL(localUrl);
                } catch (e2b) {
                }
              }
            } else if (src) {
              d.images.push(src);
            }
            renderImgs();
            try {
              if (typeof globalThis.__dfFixComposeImgs === "function") globalThis.__dfFixComposeImgs(page);
            } catch (e3) {
            }
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
      <div class="mom-modal-head"><span>\u8BBE\u7F6E</span><button class="mom-modal-x" data-x>\u2715</button></div>
      <div class="mom-modal-body">
        <label class="mom-field">\u6635\u79F0<input class="mom-inp" data-nick value="${esc(cfg.nickname || "")}"></label>
        <label class="mom-field">\u7B7E\u540D<input class="mom-inp" data-sig value="${esc(cfg.signature || "")}"></label>
        <div class="mom-field">
          <span>\u5934\u50CF</span>
          <label class="mom-btn mom-btn-small">\u4E0A\u4F20\u5934\u50CF<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,.jpg,.jpeg,.png,.webp,.gif,.bmp" hidden data-avatar></label>
          <span class="mom-hint">\u5EFA\u8BAE JPG/PNG/WebP\uFF1B\u4E0D\u652F\u6301 HEIC</span>
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
          try {
            ctx.showMessage && ctx.showMessage("\u5934\u50CF\u4E0A\u4F20\u4E2D\u2026");
            const url = await saveImageToAssets(f, { maxDim: 640, quality: 0.9 });
            if (url) {
              cfg.avatar = url;
              ctx.showMessage("\u5934\u50CF\u5DF2\u66F4\u65B0");
              try { if (globalThis.__DF_ASSETS) await globalThis.__DF_ASSETS.hydrate({ config: cfg, items: [] }); } catch (e0) {}
              await ctx.save();
              ctx.reApp();
            } else {
              ctx.showMessage && ctx.showMessage("\u5934\u50CF\u4E0A\u4F20\u5931\u8D25");
            }
          } catch (eAv) {
            console.warn("[orca-diaryflow] avatar upload", eAv);
            ctx.showMessage && ctx.showMessage((eAv && eAv.message) || "\u5934\u50CF\u4E0D\u652F\u6301\u8BE5\u683C\u5F0F");
          }
        } else if (t.matches("[data-cover]")) {
          const f = (t.files || [])[0];
          if (!f) return;
          try {
            ctx.showMessage && ctx.showMessage("\u5C01\u9762\u4E0A\u4F20\u4E2D\u2026");
            const url = await saveImageToAssets(f, { maxDim: 1920, quality: 0.85 });
            if (url) {
              cfg.cover = url;
              ctx.showMessage("\u5C01\u9762\u5DF2\u66F4\u65B0");
              try { if (globalThis.__DF_ASSETS) await globalThis.__DF_ASSETS.hydrate({ config: cfg, items: [] }); } catch (e1) {}
              await ctx.save();
              ctx.reApp();
            } else {
              ctx.showMessage && ctx.showMessage("\u5C01\u9762\u4E0A\u4F20\u5931\u8D25");
            }
          } catch (eCv) {
            console.warn("[orca-diaryflow] cover upload", eCv);
            ctx.showMessage && ctx.showMessage((eCv && eCv.message) || "\u5C01\u9762\u4E0D\u652F\u6301\u8BE5\u683C\u5F0F");
          }
        } else if (t.matches("[data-lockbg]")) {
          const f = (t.files || [])[0];
          if (!f) return;
          try {
            const url = await saveImageToAssets(f, { maxDim: 1920, quality: 0.85 });
            if (url) {
              cfg.lockBg = url;
              ctx.showMessage("\u9501\u5C4F\u80CC\u666F\u5DF2\u66F4\u65B0");
              try { if (globalThis.__DF_ASSETS) await globalThis.__DF_ASSETS.hydrate({ config: cfg, items: [] }); } catch (e2) {}
              await ctx.save();
            } else {
              ctx.showMessage && ctx.showMessage("\u9501\u5C4F\u80CC\u666F\u4E0A\u4F20\u5931\u8D25");
            }
          } catch (eLk) {
            console.warn("[orca-diaryflow] lockbg upload", eLk);
            ctx.showMessage && ctx.showMessage((eLk && eLk.message) || "\u4E0D\u652F\u6301\u8BE5\u683C\u5F0F");
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



// ===== i18n (zh -> en) =====
// ============================================================
// src/orca-i18n.js — 轻量国际化（中 → 英）
// 策略：以中文原文为 key 的短语替换，避免逐条改写业务逻辑。
// - dfT(s)：翻译单条文案（通知/消息/动态标签）
// - dfMountDialog(host)：挂载纯静态对话框并整体翻译（不含用户内容）
// - 用户内容（日记正文/标题/用户标签）绝不经过翻译
// ============================================================

var DF_I18N_EN = {
  "日记流 · 使用说明": "Diary Flow · Getting Started",
  "日记流": "Diary Flow",
  "工具": "Tools",
  "归档柜": "Archive",
  "已归档条目": "Archived entries",
  "回收站": "Trash",
  "删除后约保留 30 天": "Kept about 30 days after deletion",
  "搜索": "Search",
  "在日记流内按关键词筛选": "Filter the feed by keyword",
  "统计": "Stats",
  "年/月计数、连续打卡、标签分布": "Year/month counts, streaks, tag distribution",
  "导出": "Export",
  "Markdown / 按月 zip / JSON 备份": "Markdown / monthly zip / JSON backup",
  "回顾": "Recap",
  "去年今日、随机一条": "On this day last year · random entry",
  "布局": "Layout",
  "封面高度：紧凑 / 舒适 / 高封面": "Cover height: compact / cozy / tall",
  "关闭": "Close",
  "返回": "Back",
  "打开": "Open",
  "取消": "Cancel",
  "确定": "OK",
  "清除": "Clear",
  "添加": "Add",
  "删除": "Delete",
  "恢复": "Restore",
  "彻底删除": "Delete permanently",
  "清空回收站": "Empty trash",
  "取消归档": "Unarchive",
  "暂无归档": "No archived entries",
  "回收站为空": "Trash is empty",
  "加载中…": "Loading…",
  "加载失败": "Failed to load",
  "暂无": "None",
  "全部": "All",
  "今年": "This year",
  "本月": "This month",
  "连续打卡（天）": "Streak (days)",
  "有记录天数": "Days logged",
  "含图": "With images",
  "含地点": "With location",
  "置顶": "Pinned",
  "取消置顶": "Unpin",
  "年份": "Years",
  "近月": "Recent months",
  "标签分布": "Tag distribution",
  "暂无用户标签": "No user tags",
  "归档": "Archive",
  "管理图片": "Manage images",
  "在虎鲸中打开": "Open in Orca",
  "更多": "More",
  "更多操作": "More actions",
  "收起": "Collapse",
  "标签": "Tags",
  "标签筛选": "Tag filter",
  "暂无标签": "No tags",
  "添加地点": "Add location",
  "点击修改地点": "Click to edit location",
  "修改时间": "Edit time",
  "地点": "Location",
  "地点：": "Location: ",
  "标签：": "Tags: ",
  "写入正文末行「地点：…」，并同步到虎鲸属性 df.location。":
    "Written to the last line as “地点：…”, and synced to the Orca property df.location.",
  "会同步到日记流展示；若改了日期，条目会移到虎鲸对应日记页。":
    "Shown in the feed; changing the date moves the entry to the matching Orca journal.",
  "例如：咖啡馆 / 公司": "e.g. Cafe / Office",
  "新建标签，回车添加": "New tag, press Enter",
  "写入虎鲸真实标签；可用 FAB / 顶栏筛选。#日记流 为入流标签，不可在此修改。":
    "Written as real Orca tags; filter via FAB / top bar. #日记流 is the feed tag and cannot be changed here.",
  "暂无标签，可在下方新建": "No tags yet — create one below",
  "#日记流 为系统标签": "#日记流 is a system tag",
  "标签已更新": "Tags updated",
  "改标签失败: ": "Failed to update tags: ",
  "时间无效": "Invalid time",
  "时间已更新": "Time updated",
  "改时间失败: ": "Failed to update time: ",
  "地点已更新": "Location updated",
  "地点已清除": "Location cleared",
  "改地点失败: ": "Failed to update location: ",
  "无效的日记块 ID": "Invalid diary block ID",
  "无效 trashId": "Invalid trashId",
  "无效 blockId": "Invalid blockId",
  "块不存在": "Block not found",
  "找不到对应虎鲸块": "Matching Orca block not found",
  "找不到条目": "Entry not found",
  "评论不能为空": "Comment cannot be empty",
  "已新建，请在虎鲸中编辑": "Created — edit it in Orca",
  "已创建条目，请到今日日记继续编辑": "Entry created — continue editing in today's journal",
  "新建失败: ": "Create failed: ",
  "日记流已同步": "Feed synced",
  "同步失败": "Sync failed",
  "同步日记流": "Sync feed",
  "无法加载标签": "Failed to load tags",
  "暂不支持 ": "Unsupported: ",
  "，请先转为 JPG/PNG/WebP": "; please convert to JPG/PNG/WebP first",
  "暂不支持 SVG 作为头像/封面，请用 JPG/PNG": "SVG is not supported for avatar/cover; please use JPG/PNG",
  "图片尺寸无效，请换一张 JPG/PNG": "Invalid image dimensions; please use another JPG/PNG",
  "图片过大或无法解码，请压缩后重试": "Image too large or undecodable; compress it and retry",
  "图片转码失败，请换 JPG/PNG 重试": "Image conversion failed; try another JPG/PNG",
  "无法读取该图片（格式不支持或已损坏），请用 JPG/PNG/WebP": "Cannot read this image (unsupported or corrupted); use JPG/PNG/WebP",
  "已取消标签筛选": "Tag filter cleared",
  "已按标签过滤 #": "Filtered by tag #",
  "标签筛选 · #": "Tag filter · #",
  "打开日记流": "Open Diary Flow",
  "打开日记流面板": "Open Diary Flow panel",
  "当前没有可用的面板": "No panel is currently available",
  "无法创建日记流面板": "Could not create the Diary Flow panel",
  "暂无月份分组": "No month groups",
  "该月暂无日记": "No entries in that month",
  "该日期暂无动态，已打开当天日记": "No entry on that date — opened that day's journal",
  "日历": "Calendar",
  "照片": "Photos",
  "热度": "Heatmap",
  "上半年": "First half",
  "下半年": "Second half",
  "暂无记录": "No records",
  "搜索标题…": "Search titles…",
  "没有匹配的条目": "No matching entries",
  "标题": "Title",
  "删除时间（新→旧）": "Deleted (newest first)",
  "删除时间（旧→新）": "Deleted (oldest first)",
  "时间（新→旧）": "Date (newest first)",
  "时间（旧→新）": "Date (oldest first)",
  "点年份快速定位": "Tap a year to jump",
  "这一年没有日记。": "No entries this year.",
  "月份大纲": "Month outline",
  "仍保留在日记页": "Still kept on the journal page",
  "保留约 30 天": "Kept about 30 days",
  "已取消归档": "Unarchived",
  "取消归档失败": "Failed to unarchive",
  "已恢复：": "Restored: ",
  "已恢复（原归档条目已回到时间线）：": "Restored (previously archived entry is back on the timeline): ",
  "恢复失败：未能创建条目": "Restore failed: could not create entry",
  "回收站条目不存在": "Trash item not found",
  "快照文件损坏或缺失": "Snapshot file is missing or corrupted",
  "彻底删除该条目？不可恢复。": "Permanently delete this entry? This cannot be undone.",
  "确定清空回收站？共 ": "Empty the trash? All ",
  "项将永久删除，不可恢复。": " items will be permanently deleted and cannot be recovered.",
  "已移入回收站": "Moved to trash",
  "将这条日记移入回收站？\n（可在回收站恢复，约保留 30 天）\n":
    "Move this entry to trash?\n(Restorable from trash for about 30 days)\n",
  "已归档": "Archived",
  "归档失败": "Archive failed",
  "归档这条日记？\n主时间线将隐藏，可在归档柜取消归档。\n":
    "Archive this entry?\nIt will be hidden from the main timeline; you can unarchive it in the Archive.\n",
  "删除失败": "Delete failed",
  "清空失败": "Failed to empty",
  "删除这条评论？": "Delete this comment?",
  "已删除评论": "Comment deleted",
  "删除评论失败": "Failed to delete comment",
  "编辑": "Edit",
  "编辑评论": "Edit comment",
  "评论": "Comments",
  "发送": "Send",
  "写评论…": "Write a comment…",
  "写评论...": "Write a comment...",
  "播放视频": "Play video",
  "已点赞": "Liked",
  "点赞": "Like",
  "取消赞": "Unlike",
  "发表日记": "New diary entry",
  "在虎鲸中新建": "Create in Orca",
  "在虎鲸中编辑": "Edit in Orca",
  "在虎鲸中写": "Write in Orca",
  "还没有动态": "No entries yet",
  "记录下这一刻，让日子可以回头。": "Capture this moment so the days can be revisited.",
  "可以写文字、上传图片，还能加上标签 • 点击下方按钮发布第一条":
    "Write text, add images and tags • tap the button below to post your first entry",
  "在虎鲸日记里编辑文字、图片与标签 • 点下方按钮新建并打开":
    "Edit text, images and tags in the Orca journal • tap the button below to create and open",
  "新建日记": "New entry",
  "模板": "Template",
  "用模板覆盖当前内容？": "Replace current content with the template?",
  "写点什么…": "Write something…",
  "标签（空格/逗号分隔）": "Tags (space/comma separated)",
  "天气": "Weather",
  "心情": "Mood",
  "心情 / 天气": "Mood / Weather",
  "生成分享图": "Share image",
  "已生成分享图片": "Share image created",
  "生成失败": "Generation failed",
  "发布": "Publish",
  "发布并打开": "Publish & open",
  "发布失败: ": "Publish failed: ",
  "已发布": "Published",
  "评论已更新": "Comment updated",
  "评论更新失败": "Failed to update comment",
  "评论已写入日记": "Comment written to the diary",
  "评论失败": "Comment failed",
  "今天过期": "expires today",
  "剩不到 1 天": "less than 1 day left",
  "加载更多（": "Load more (",
  "回收站不可用": "Trash is unavailable",
  "归档柜不可用": "Archive is unavailable",
  "回收站已清空": "Trash emptied",
  "导出会拉取全文；按月 zip 为无压缩 Markdown 包。":
    "Export fetches full text; the monthly zip is an uncompressed Markdown bundle.",
  "导出全部 Markdown": "Export all as Markdown",
  "导出当前筛选 Markdown": "Export current filter as Markdown",
  "按月打包 zip": "Package by month (zip)",
  "导出 JSON 备份": "Export JSON backup",
  "导出 Word（.doc）": "Export Word (.doc)",
  "已导出 Word（": "Exported Word (",
  "图": "Image ",
  "图片说明": "Caption",
  "全部取消归档": "Unarchive all",
  "全部取消归档？共 ": "Unarchive all? ",
  "全部恢复": "Restore all",
  "全部恢复？共 ": "Restore all? ",
  "清理图片": "Clean up images",
  "移除未引用的插件图片": "Remove unreferenced plugin images",
  "仅删除插件图片目录中未被封面/头像/日记条目引用的文件。": "Only removes plugin image files not referenced by cover/avatar/diary entries.",
  "没有可清理的图片": "No unused images",
  "清理": "Clean up",
  "清理中 ": "Cleaning ",
  "清理未引用图片？共 ": "Clean up unused images? ",
  " 个文件": " files",
  " 个图片": " images",
  " 个": "",
  "无法访问插件图片": "Cannot access plugin images",
  "已清理 ": "Cleaned ",
  "清理完成，失败 ": "Done, failed ",
  "准备中…": "Preparing…",
  "导出失败": "Export failed",
  "失败：": "Failed: ",
  "已下载 ": "Downloaded ",
  " 条 Markdown": " entries as Markdown",
  "已导出 Markdown（": "Exported Markdown (",
  " 条）": " entries)",
  "已下载 JSON（": "Downloaded JSON (",
  "已导出 JSON 备份": "Exported JSON backup",
  "(无标题)": "(untitled)",
  " 条": " entries",
  "暂无条目": "No entries",
  "已打包 ": "Packaged ",
  " 个月份文件": " monthly files",
  "已导出按月 zip": "Exported monthly zip",
  "去年今日没有日记": "No diary on this day last year",
  "去年今日没有日记 — 可点「随机一条」":
    "No diary on this day last year — try “Random entry”",
  "暂无日记": "No entries yet",
  "随机一条": "Random entry",
  "去年今日": "On this day last year",
  "关键词（匹配日记流条目正文）": "Keyword (matches entry text)",
  "例如：旅行 / 心情": "e.g. travel / mood",
  "在日记流中筛选": "Filter the feed",
  "清除关键词": "Clear keyword",
  "也可使用虎鲸全局搜索；此处仅限带「日记流」标签的条目。":
    "You can also use Orca global search; this only searches entries tagged “日记流”.",
  "已筛选：": "Filtered: ",
  "已筛选": "Filtered",
  "已清除搜索": "Search cleared",
  "快捷筛选": "Quick filters",
  "打印 / 另存为 PDF": "Print / Save as PDF",
  "已打开打印（可另存为 PDF）": "Opened print dialog (Save as PDF)",
  "已导出 HTML（可直接打印为 PDF）": "Exported HTML (print it to PDF)",
  "窄屏可选手「紧凑」缩小封面；宽屏可用「高封面」。":
    "On narrow screens choose Compact to shrink the cover; Tall suits wide screens.",
  "紧凑 — 矮封面、更密列表": "Compact — shorter cover, denser list",
  "舒适 — 默认": "Cozy — default",
  "高封面 — 更强氛围": "Tall — more atmosphere",
  "当前：": "Current: ",
  "紧凑": "Compact",
  "舒适": "Cozy",
  "高封面": "Tall",
  "布局已设为「": "Layout set to “",
  "」": "”",
  "图片（最多 9 张）": "Images (up to 9)",
  "可添加、排序；失败可重试后保存": "Add or reorder; retry failed ones before saving",
  "添加图片": "Add images",
  "重试失败": "Retry failed",
  "保存到日记": "Save to diary",
  "暂无图片": "No images",
  "失败": "Failed",
  "上传中…": "Uploading…",
  "等待上传": "Waiting to upload",
  "就绪": "Ready",
  "上传完成：成功 ": "Upload finished: OK ",
  " / 失败 ": " / failed ",
  "无需上传": "Nothing to upload",
  "保存中…": "Saving…",
  "仍有 ": "Still ",
  " 张失败，可重试后再保存": " failed — retry before saving",
  "图片已保存": "Images saved",
  "保存失败：": "Save failed: ",
  "保存图片失败": "Failed to save images",
  "最多 9 张图": "Up to 9 images",
  "筛选": "Filters",
  "有图": "Has images",
  "有地点": "Has location",
  "仅置顶": "Pinned only",
  "清除筛选": "Clear filters",
  "搜索：": "Search: ",
  "日期：": "Date: ",
  "清除日期": "Clear date",
  "工具（归档/回收站/搜索/统计/导出…）":
    "Tools (archive / trash / search / stats / export …)",
  "已插入使用说明（置顶）": "Inserted the guide (pinned)",
  "已补全使用说明正文": "Repaired the guide content",
  "日记流插件已加载（深融合虎鲸）": "Diary Flow plugin loaded (deep Orca integration)",
  "日记流插件已卸载": "Diary Flow plugin unloaded",
  "共 ": "Total ",
  " 条已归档": " archived",
  " 条 · 约保留 30 天": " · kept about 30 days",
  "我": "Me",
  "每页条目数": "Entries per page",
  "时间线底部「加载更多」每次增加的条目数": "How many entries each “Load more” adds",
  "回收站保留天数": "Trash retention (days)",
  "删除的日记在回收站中保留的天数": "Days deleted entries stay in the trash",
  "删除前确认": "Confirm before deleting",
  "删除或归档日记前弹出确认框": "Show a confirmation before deleting or archiving",
  "自动清理图片": "Auto-clean images",
  "启动后自动移除未被引用的插件图片（回收站与归档条目引用会保留）":
    "Automatically remove unreferenced plugin images on startup (trash and archived references are kept)",
  "导出图片最大宽度": "Export image max width",
  "导出 Word/PDF 时内嵌图片的最大宽度（像素，0 表示不压缩）":
    "Max width (px) of embedded images when exporting Word/PDF (0 = no compression)",
  "自动备份": "Auto backup",
  "启动后自动备份（每天一次）到插件备份目录": "Back up automatically to the plugin backup folder once a day on startup",
  "备份保留份数": "Backups to keep",
  "自动备份最多保留的份数": "Maximum number of auto backups to keep",
  "标签重命名": "Rename tags",
  "批量改名 / 合并 / 删除标签": "Bulk rename / merge / delete tags",
  "把一个用户标签在所有条目中改为新标签；新标签留空则删除该标签。":
    "Rename a user tag on all entries; leave the new tag empty to delete it.",
  "原标签": "Old tag",
  "新标签（留空则删除）": "New tag (empty to delete)",
  "新标签名": "New tag name",
  "应用": "Apply",
  "请选择原标签": "Choose the old tag",
  "新标签与原标签相同": "New tag equals old tag",
  "将 #": "Change #",
  " 改为 ": " to ",
  "（删除）": " (delete)",
  "正在处理…": "Processing…",
  "已处理 ": "Processed ",
  "处理失败": "Update failed",
  "备份与恢复": "Backup & Restore",
  "导出 / 恢复 JSON 备份": "Export / restore JSON backup",
  "备份保存到插件备份目录（JSON）。恢复会新增条目，不改动现有数据。":
    "Backups are saved as JSON in the plugin backup folder. Restoring adds new entries and never modifies existing data.",
  "立即备份": "Back up now",
  "从文件导入": "Import from file",
  "暂无备份": "No backups",
  "导入失败": "Import failed",
  "恢复该备份？将新增 ": "Restore this backup? It will add ",
  "正在恢复…": "Restoring…",
  "已恢复 ": "Restored ",
  "恢复失败": "Restore failed",
  "正在备份…": "Backing up…",
  "已备份 ": "Backed up ",
  "备份失败": "Backup failed",
  "读取中…": "Reading…",
  "读取失败": "Read failed",
  "约保留 ": "Kept about ",
  " 天": " days"
};

var DF_I18N_KEYS = null;

function dfLocaleIsEn() {
  try {
    var loc = String((orca.state && orca.state.locale) || "zh").toLowerCase();
    return loc.indexOf("en") === 0;
  } catch (e) {
    return false;
  }
}

/** 翻译单条文案（支持在长句中对已知短语做替换） */
function dfT(s) {
  if (s == null) return s;
  if (!dfLocaleIsEn()) return String(s);
  var str = String(s);
  if (!str) return str;
  if (!DF_I18N_KEYS) {
    DF_I18N_KEYS = Object.keys(DF_I18N_EN).sort(function (a, b) { return b.length - a.length; });
  }
  for (var i = 0; i < DF_I18N_KEYS.length; i++) {
    var k = DF_I18N_KEYS[i];
    if (str.indexOf(k) >= 0) str = str.split(k).join(DF_I18N_EN[k]);
  }
  return str;
}

var DF_I18N_ATTRS = ["title", "aria-label", "placeholder"];

/** 翻译 DOM 子树中的静态文案与常见属性（仅用于不含用户内容的对话框） */
function dfLocalizeEl(root) {
  if (!root || !dfLocaleIsEn()) return root;
  try {
    if (root.nodeType === 3) {
      if (root.nodeValue && /[\u4e00-\u9fff]/.test(root.nodeValue)) {
        root.nodeValue = dfT(root.nodeValue);
      }
      return root;
    }
    if (root.nodeType !== 1) return root;
    for (var a = 0; a < DF_I18N_ATTRS.length; a++) {
      var name = DF_I18N_ATTRS[a];
      if (root.hasAttribute && root.hasAttribute(name)) {
        var v = root.getAttribute(name);
        if (v && /[\u4e00-\u9fff]/.test(v)) root.setAttribute(name, dfT(v));
      }
    }
    var kids = root.childNodes || [];
    for (var i = 0; i < kids.length; i++) dfLocalizeEl(kids[i]);
  } catch (e) { /* ignore */ }
  return root;
}

/** 挂载对话框：追加到 body，并在英文环境下整体翻译静态文案 */
function dfMountDialog(host) {
  document.body.appendChild(host);
  if (dfLocaleIsEn()) dfLocalizeEl(host);
  return host;
}

/** 英文月名 */
var DF_I18N_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var DF_CAL_MONTHS_ZH = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

/** 封面日历：月份短名（按语言） */
function dfCalMonthsShort() {
  return dfLocaleIsEn() ? DF_I18N_MONTHS : DF_CAL_MONTHS_ZH;
}

/** 封面日历：月份标题，如 2026年1月 / Jan 2026 */
function dfCalMonthTitle(year, monthIndex) {
  if (dfLocaleIsEn()) return DF_I18N_MONTHS[monthIndex] + " " + year;
  return year + "年" + (Number(monthIndex) + 1) + "月";
}

/** 封面日历：单元格提示，如 1月5日: 3条 / Jan 5: 3 */
function dfCalTip(monthIndex, day, count) {
  if (dfLocaleIsEn()) {
    var base = DF_I18N_MONTHS[monthIndex] + " " + day;
    return count > 0 ? (base + ": " + count) : base;
  }
  var zh = (Number(monthIndex) + 1) + "月" + day + "日";
  return count > 0 ? (zh + ": " + count + "条") : zh;
}


// ===== Settings =====
// ============================================================
// src/orca-settings.js — 插件设置页（orca.plugins.setSettingsSchema）
// 设置值同步读取 orca.state.plugins[name].settings；未设置时用默认值。
// ============================================================

var DF_SETTINGS_DEFAULTS = {
  itemsPerPage: 25,
  trashRetentionDays: 30,
  confirmDelete: true,
  autoCleanImages: false,
  exportImageMaxWidth: 0,
  autoBackup: false,
  backupKeep: 7
};

function dfSettingsObject() {
  try {
    var plugins = orca.state && orca.state.plugins;
    var p = plugins && plugins[orcaPluginName];
    return (p && p.settings) || {};
  } catch (e) {
    return {};
  }
}

function dfGetSetting(key) {
  var v;
  try { v = dfSettingsObject()[key]; } catch (e) { v = undefined; }
  if (v === undefined || v === null || v === "") return DF_SETTINGS_DEFAULTS[key];
  return v;
}

function dfGetNumberSetting(key, minVal) {
  var n = Number(dfGetSetting(key));
  if (!isFinite(n) || n <= 0) n = Number(DF_SETTINGS_DEFAULTS[key]);
  if (isFinite(minVal) && n < minVal) n = minVal;
  return Math.floor(n);
}

/** 时间线每页条数（设置项 itemsPerPage） */
function dfFeedPageSize() {
  return dfGetNumberSetting("itemsPerPage", 1);
}

/** 回收站保留天数（设置项 trashRetentionDays） */
function dfTrashRetentionDays() {
  return dfGetNumberSetting("trashRetentionDays", 1);
}

/** 导出内嵌图片最大宽度（设置项 exportImageMaxWidth，0=不压缩） */
function dfGetExportImageMaxWidth() {
  var n = Number(dfGetSetting("exportImageMaxWidth"));
  if (!isFinite(n) || n < 0) n = 0;
  return Math.floor(n);
}

async function dfRegisterSettings() {
  if (!orca.plugins || typeof orca.plugins.setSettingsSchema !== "function") return;
  try {
    await orca.plugins.setSettingsSchema(orcaPluginName, {
      itemsPerPage: {
        label: dfT("每页条目数"),
        description: dfT("时间线底部「加载更多」每次增加的条目数"),
        type: "number",
        defaultValue: DF_SETTINGS_DEFAULTS.itemsPerPage
      },
      trashRetentionDays: {
        label: dfT("回收站保留天数"),
        description: dfT("删除的日记在回收站中保留的天数"),
        type: "number",
        defaultValue: DF_SETTINGS_DEFAULTS.trashRetentionDays
      },
      confirmDelete: {
        label: dfT("删除前确认"),
        description: dfT("删除或归档日记前弹出确认框"),
        type: "boolean",
        defaultValue: DF_SETTINGS_DEFAULTS.confirmDelete
      },
      autoCleanImages: {
        label: dfT("自动清理图片"),
        description: dfT("启动后自动移除未被引用的插件图片（回收站与归档条目引用会保留）"),
        type: "boolean",
        defaultValue: DF_SETTINGS_DEFAULTS.autoCleanImages
      },
      exportImageMaxWidth: {
        label: dfT("导出图片最大宽度"),
        description: dfT("导出 Word/PDF 时内嵌图片的最大宽度（像素，0 表示不压缩）"),
        type: "number",
        defaultValue: DF_SETTINGS_DEFAULTS.exportImageMaxWidth
      },
      autoBackup: {
        label: dfT("自动备份"),
        description: dfT("启动后自动备份（每天一次）到插件备份目录"),
        type: "boolean",
        defaultValue: DF_SETTINGS_DEFAULTS.autoBackup
      },
      backupKeep: {
        label: dfT("备份保留份数"),
        description: dfT("自动备份最多保留的份数"),
        type: "number",
        defaultValue: DF_SETTINGS_DEFAULTS.backupKeep
      }
    });
  } catch (e) {
    console.warn("[orca-diaryflow] setSettingsSchema failed", e);
  }
}


// ===== Orca blocks store =====
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
    imagesMeta: Array.isArray(overlay.imagesMeta)
      ? overlay.imagesMeta.filter(function (x) { return typeof x === "string"; }).slice(0, 9)
      : [],
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
    mood: String(dfProp(block, "df.mood") || overlay.mood || ""),
    weather: String(dfProp(block, "df.weather") || overlay.weather || ""),
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
  var mood = dfProp(block, "df.mood");
  if (mood) parts.push(String(mood));
  var weather = dfProp(block, "df.weather");
  if (weather) parts.push(String(weather));
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
  if (payload.imagesMeta !== undefined) {
    patch.imagesMeta = Array.isArray(payload.imagesMeta)
      ? payload.imagesMeta.map(function (s) { return String(s == null ? "" : s); }).slice(0, 9)
      : [];
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

/** 心情 / 天气：写块属性 df.mood / df.weather（空则删除） */
async function updateEntryMeta(blockId, meta) {
  var id = dfBlockId(blockId);
  if (!id) throw new Error("无效 blockId");
  meta = meta || {};
  var mood = String(meta.mood == null ? "" : meta.mood).trim();
  var weather = String(meta.weather == null ? "" : meta.weather).trim();
  await dfWithEditor(async function () {
    var sets = [];
    if (mood) sets.push({ name: "df.mood", type: DF_PROP_TEXT, value: mood });
    if (weather) sets.push({ name: "df.weather", type: DF_PROP_TEXT, value: weather });
    if (sets.length) {
      try { await dfEditorCommand("core.editor.setProperties", null, [id], sets); } catch (eSet) { /* ignore */ }
    }
    var dels = [];
    if (!mood) dels.push("df.mood");
    if (!weather) dels.push("df.weather");
    if (dels.length) {
      try { await dfEditorCommand("core.editor.deleteProperties", null, [id], dels); } catch (eDel) { /* ignore */ }
    }
  });
  try { delete orca.state.blocks[id]; } catch (e0) { /* ignore */ }
  return { block: await dfGetBlock(id), mood: mood, weather: weather };
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
  updateEntryMeta: updateEntryMeta,
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


// ===== Orca trash (soft-delete) =====
// ============================================================
// src/orca-trash.js — 日记流回收站（借鉴 orca-plugin-pizhu）
// 仅拦截本插件 deleteEntry，不 hook 全局 delete-blocks（避免与批注冲突）
// 快照 → 插件文件 trash/*.json + 索引 moments-trash-index → 可恢复 / 彻底删除
// ============================================================

var DF_TRASH_INDEX_KEY = "moments-trash-index";
var DF_TRASH_RETENTION_DAYS = 30;

function dfTrashRepo() {
  try {
    return String((orca.state && orca.state.repo) || "default");
  } catch (e) {
    return "default";
  }
}

function dfTrashFileName(trashId) {
  return "trash/" + dfTrashRepo() + "/" + trashId + ".json";
}

function dfTrashGenId() {
  return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function dfTrashTitleOf(text) {
  var line = String(text || "").replace(/\r\n/g, "\n").split("\n").map(function (s) {
    return s.trim();
  }).filter(Boolean)[0] || "";
  return line ? line.slice(0, 80) : "(无标题)";
}

async function dfTrashReadIndex() {
  try {
    var v = await orca.plugins.getData(orcaPluginName, DF_TRASH_INDEX_KEY);
    if (v == null) return [];
    if (typeof v === "string") {
      try { v = JSON.parse(v); } catch (e) { return []; }
    }
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

async function dfTrashWriteIndex(list) {
  await orca.plugins.setData(orcaPluginName, DF_TRASH_INDEX_KEY, JSON.stringify(Array.isArray(list) ? list : []));
}

async function dfTrashWriteFile(rel, obj) {
  var raw = JSON.stringify(obj);
  try {
    await orca.invokeBackend("set-plugin-file", orcaPluginName, rel, raw);
  } catch (e1) {
    try {
      var enc = new TextEncoder().encode(raw);
      await orca.invokeBackend("set-plugin-file", orcaPluginName, rel, enc);
    } catch (e2) {
      throw e2 || e1;
    }
  }
}

async function dfTrashReadFile(rel) {
  var raw = null;
  try {
    raw = await orca.invokeBackend("get-plugin-file", orcaPluginName, rel);
  } catch (e) {
    try {
      raw = await orca.invokeBackend("get-plugin-file", orcaPluginName, rel, "text");
    } catch (e2) {
      raw = null;
    }
  }
  if (raw == null) return null;
  if (typeof raw !== "string") {
    try {
      if (raw instanceof ArrayBuffer) raw = new TextDecoder().decode(new Uint8Array(raw));
      else if (raw.buffer) raw = new TextDecoder().decode(raw);
      else raw = String(raw);
    } catch (e3) {
      raw = String(raw);
    }
  }
  try {
    return JSON.parse(raw);
  } catch (e4) {
    return null;
  }
}

async function dfTrashRemoveFile(rel) {
  try {
    await orca.invokeBackend("remove-plugin-file", orcaPluginName, rel);
  } catch (e) { /* ignore */ }
}

/** 删除前快照：正文/标签/图/地点/评论/overlay/日记日 */
async function dfSnapshotEntryForTrash(blockId) {
  var id = dfBlockId(blockId);
  if (!id) throw new Error("无效 blockId");
  var block = await dfGetBlock(id);
  if (!block) throw new Error("块不存在");
  var text = "";
  try { text = await dfCollectEntryText(block, { shallow: false }); } catch (e) {
    text = dfPlainContentText(block) || "";
  }
  var tags = dfNormalizeUserTags(dfTagsOf(block));
  var images = [];
  try {
    images = (await dfCollectImageSrcs(block)).map(dfResolveOrcaAssetSrc).filter(Boolean).slice(0, 9);
  } catch (eImg) { images = []; }
  var comments = [];
  try { comments = await dfCollectCommentsFromBlock(block); } catch (eC) { comments = []; }
  var index = await dfLoadIndex();
  var overlay = (index.overlays && index.overlays[String(id)]) || {};
  var location = dfResolveLocation(block, overlay);
  var jd = null;
  try { jd = await dfJournalDateOfBlock(block); } catch (eJ) { jd = null; }
  var trashId = dfTrashGenId();
  return {
    trashId: trashId,
    fileName: dfTrashFileName(trashId),
    legacyBlockId: id,
    deletedAt: Date.now(),
    title: dfTrashTitleOf(text),
    journalDate: jd && !isNaN(jd.getTime()) ? jd.toISOString() : null,
    text: text,
    tags: tags,
    images: images,
    location: location || "",
    comments: comments,
    overlay: {
      pinned: !!overlay.pinned,
      archived: !!overlay.archived || dfIsArchived(block, overlay),
      createdAt: overlay.createdAt || null,
      isTutorial: !!overlay.isTutorial,
      commentsStorage: "orca-blocks"
    }
  };
}

async function dfMoveEntryToTrash(blockId) {
  var record = await dfSnapshotEntryForTrash(blockId);
  await dfTrashWriteFile(record.fileName, record);
  var list = await dfTrashReadIndex();
  list = list.filter(function (e) { return e && e.trashId !== record.trashId; });
  list.push({
    trashId: record.trashId,
    fileName: record.fileName,
    deletedAt: record.deletedAt,
    title: record.title,
    legacyBlockId: record.legacyBlockId,
    journalDate: record.journalDate
  });
  await dfTrashWriteIndex(list);
  return record;
}

async function trashList() {
  var list = await dfTrashReadIndex();
  var ttl = dfTrashRetentionDays() * 864e5;
  var now = Date.now();
  return list.map(function (e) {
    return Object.assign({}, e, {
      remainingMs: Math.max(0, (e.deletedAt || 0) + ttl - now)
    });
  }).sort(function (a, b) { return (b.deletedAt || 0) - (a.deletedAt || 0); });
}

async function trashCount() {
  try {
    return (await trashList()).length;
  } catch (e) {
    return 0;
  }
}

async function restoreTrashItem(trashId) {
  var want = String(trashId || "");
  if (!want) throw new Error("无效 trashId");
  var list = await dfTrashReadIndex();
  var meta = null;
  for (var i = 0; i < list.length; i++) {
    if (list[i] && String(list[i].trashId) === want) { meta = list[i]; break; }
  }
  if (!meta) throw new Error("回收站条目不存在");
  var record = await dfTrashReadFile(meta.fileName || dfTrashFileName(want));
  if (!record || typeof record !== "object") throw new Error("快照文件损坏或缺失");

  var date = record.journalDate ? new Date(record.journalDate) : null;
  if (!date || isNaN(date.getTime())) {
    if (record.overlay && record.overlay.createdAt) date = new Date(Number(record.overlay.createdAt));
  }
  if (!date || isNaN(date.getTime())) date = new Date(record.deletedAt || Date.now());

  var block = await createEntry({
    date: date,
    text: record.text || "",
    tags: record.tags || [],
    images: record.images || [],
    location: record.location || "",
    pinned: !!(record.overlay && record.overlay.pinned),
    isTutorial: !!(record.overlay && record.overlay.isTutorial)
  });
  var newId = dfBlockId(block);
  if (!newId) throw new Error("恢复失败：未能创建条目");

  var cmts = Array.isArray(record.comments) ? record.comments : [];
  for (var ci = 0; ci < cmts.length; ci++) {
    try { await dfInsertCommentBlock(newId, cmts[ci]); } catch (eC) {
      console.warn("[orca-diaryflow] restore comment failed", eC);
    }
  }

  var patch = {
    comments: [],
    commentsStorage: "orca-blocks",
    location: record.location || "",
    pinned: !!(record.overlay && record.overlay.pinned),
    isTutorial: !!(record.overlay && record.overlay.isTutorial)
  };
  if (record.overlay && record.overlay.archived) {
    // 恢复后默认不归档，便于回到时间线；若需保留归档态可改
    patch.archived = false;
  }
  if (record.overlay && record.overlay.createdAt) patch.createdAt = record.overlay.createdAt;
  await setOverlay(newId, patch);

  if (record.overlay && record.overlay.isTutorial) {
    try {
      await orca.plugins.setData(orcaPluginName, DF_TUTORIAL_DISMISSED_KEY, null);
      await orca.plugins.setData(orcaPluginName, DF_TUTORIAL_ID_KEY, String(newId));
    } catch (eT) { /* ignore */ }
  }

  await dfTrashRemoveFile(meta.fileName || dfTrashFileName(want));
  await dfTrashWriteIndex(list.filter(function (e) { return !(e && String(e.trashId) === want); }));
  return { blockId: newId, title: record.title, wasArchived: !!(record.overlay && record.overlay.archived) };
}

async function purgeTrashItem(trashId) {
  var want = String(trashId || "");
  var list = await dfTrashReadIndex();
  var meta = null;
  for (var i = 0; i < list.length; i++) {
    if (list[i] && String(list[i].trashId) === want) { meta = list[i]; break; }
  }
  if (meta) await dfTrashRemoveFile(meta.fileName || dfTrashFileName(want));
  await dfTrashWriteIndex(list.filter(function (e) { return !(e && String(e.trashId) === want); }));
  return true;
}

async function purgeAllTrash() {
  var list = await dfTrashReadIndex();
  for (var i = 0; i < list.length; i++) {
    if (list[i] && list[i].fileName) await dfTrashRemoveFile(list[i].fileName);
  }
  await dfTrashWriteIndex([]);
  return true;
}

async function purgeExpiredTrash() {
  var ttl = dfTrashRetentionDays() * 864e5;
  var now = Date.now();
  var list = await dfTrashReadIndex();
  var keep = [];
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    if (!e) continue;
    if (now - (e.deletedAt || 0) > ttl) {
      if (e.fileName) await dfTrashRemoveFile(e.fileName);
    } else {
      keep.push(e);
    }
  }
  if (keep.length !== list.length) await dfTrashWriteIndex(keep);
  return { removed: list.length - keep.length };
}

/** 收集所有回收站快照中引用的插件媒体文件名（自动清理时避免误删） */
async function dfTrashAllMediaRefs() {
  var refs = {};
  var list = await dfTrashReadIndex();
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    if (!e) continue;
    var rec = null;
    try { rec = await dfTrashReadFile(e.fileName || dfTrashFileName(e.trashId)); } catch (err) { rec = null; }
    var imgs = (rec && rec.images) || [];
    for (var j = 0; j < imgs.length; j++) {
      var s = imgs[j];
      var m = typeof s === "string" && s.match(/^dfasset:\/\/media\/(.+)$/);
      if (m && m[1]) refs[decodeURIComponent(m[1])] = true;
    }
  }
  return refs;
}

// 挂到 OrcaBlocks（本文件在 orca-blocks.js 之后拼接）
(function dfAttachTrashApi() {
  var api = {
    trashList: trashList,
    trashCount: trashCount,
    restoreTrashItem: restoreTrashItem,
    purgeTrashItem: purgeTrashItem,
    purgeAllTrash: purgeAllTrash,
    purgeExpiredTrash: purgeExpiredTrash,
    trashAllMediaRefs: dfTrashAllMediaRefs,
    TRASH_RETENTION_DAYS: DF_TRASH_RETENTION_DAYS,
    TRASH_INDEX_KEY: DF_TRASH_INDEX_KEY
  };
  if (typeof OrcaBlocks !== "undefined" && OrcaBlocks) {
    Object.keys(api).forEach(function (k) { OrcaBlocks[k] = api[k]; });
  }
  if (globalThis.__DF_ORCA_BLOCKS) {
    Object.keys(api).forEach(function (k) { globalThis.__DF_ORCA_BLOCKS[k] = api[k]; });
  }
})();


// ===== Orca tools (stats/export/recap/search/layout/images) =====
// ============================================================
// src/orca-tools.js — 统计 / 导出 / 回顾 / 搜索 / 布局 / 快捷筛选 / 多图管理
// ============================================================

var DF_LAYOUT_KEY = "layout-preset";
var DF_LAYOUT_DEFAULT = "cozy";
/** 图片管理对话框中新建的 blob 预览 URL；关闭对话框时统一回收，避免会话内累积 */
var orcaImagesBlobUrls = [];

function orcaToolsEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function orcaToolsItemDay(it) {
  var raw = String((it && (it.created || it.createdAt)) || "").trim();
  var m = raw.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (m) {
    return m[1] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[3]).slice(-2);
  }
  var d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  return "";
}

function orcaToolsItemTitle(it) {
  var t = String((it && it.text) || "").replace(/\r\n/g, "\n").split("\n").map(function (s) {
    return s.trim();
  }).filter(Boolean)[0] || "(无标题)";
  return t.slice(0, 80);
}

function orcaToolsQuickFilterItems(items, filters) {
  filters = filters || {};
  var from = String(filters.dateFrom || "").trim();
  var to = String(filters.dateTo || "").trim();
  return (items || []).filter(function (it) {
    if (!it) return false;
    if (filters.pinnedOnly && !it.pinned) return false;
    if (filters.hasImage && !(it.images && it.images.length)) return false;
    if (filters.hasLocation && !(it.location && String(it.location).trim())) return false;
    if (from || to) {
      var day = orcaToolsItemDay(it);
      if (!day) return false;
      if (from && day < from) return false;
      if (to && day > to) return false;
    }
    return true;
  });
}

function orcaToolsHasQuickFilters(filters) {
  filters = filters || {};
  return !!(filters.pinnedOnly || filters.hasImage || filters.hasLocation || filters.dateFrom || filters.dateTo);
}

function orcaToolsClearQuickFilters(filters) {
  if (!filters) return;
  filters.pinnedOnly = false;
  filters.hasImage = false;
  filters.hasLocation = false;
  filters.dateFrom = "";
  filters.dateTo = "";
}

function orcaToolsComputeStats(items) {
  items = items || [];
  var now = new Date();
  var y = now.getFullYear();
  var ym = y + "-" + ("0" + (now.getMonth() + 1)).slice(-2);
  var byYear = {};
  var byMonth = {};
  var byTag = {};
  var days = {};
  var withImg = 0;
  var withLoc = 0;
  var pinned = 0;
  items.forEach(function (it) {
    var day = orcaToolsItemDay(it);
    if (day) {
      days[day] = true;
      var yy = day.slice(0, 4);
      var mm = day.slice(0, 7);
      byYear[yy] = (byYear[yy] || 0) + 1;
      byMonth[mm] = (byMonth[mm] || 0) + 1;
    }
    if (it.images && it.images.length) withImg++;
    if (it.location && String(it.location).trim()) withLoc++;
    if (it.pinned) pinned++;
    (it.tags || []).forEach(function (t) {
      if (!t || t === "日记流") return;
      byTag[t] = (byTag[t] || 0) + 1;
    });
  });
  var dayList = Object.keys(days).sort();
  var streak = 0;
  function hasDay(d) { return !!days[d]; }
  function shiftDay(base, n) {
    var d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  var cursor = hasDay(shiftDay(now, 0)) ? 0 : (hasDay(shiftDay(now, -1)) ? -1 : null);
  if (cursor != null) {
    while (hasDay(shiftDay(now, cursor - streak))) streak++;
  }
  var tagRows = Object.keys(byTag).map(function (k) {
    return { tag: k, count: byTag[k] };
  }).sort(function (a, b) { return b.count - a.count; }).slice(0, 12);
  var yearRows = Object.keys(byYear).sort().reverse().map(function (k) {
    return { year: k, count: byYear[k] };
  });
  var monthRows = Object.keys(byMonth).sort().reverse().slice(0, 12).map(function (k) {
    return { month: k, count: byMonth[k] };
  });
  return {
    total: items.length,
    yearCount: byYear[String(y)] || 0,
    monthCount: byMonth[ym] || 0,
    activeDays: dayList.length,
    streak: streak,
    withImg: withImg,
    withLoc: withLoc,
    pinned: pinned,
    tagRows: tagRows,
    yearRows: yearRows,
    monthRows: monthRows
  };
}

/** 导出文件/内容的基础名（按语言） */
function orcaExportBase() {
  return dfLocaleIsEn() ? "DiaryFlow" : "日记流";
}

function orcaExportMonthTitle(month) {
  var ym = String(month || "").match(/^(\d{4})-(\d{2})$/);
  if (!ym) return String(month || "");
  if (dfLocaleIsEn()) return DF_I18N_MONTHS[Number(ym[2]) - 1] + " " + ym[1];
  return ym[1] + "年" + Number(ym[2]) + "月";
}

function orcaToolsBuildMarkdown(items, cfg) {
  cfg = cfg || {};
  var lines = ["# " + dfT("日记流") + " · " + (cfg.nickname || ""), "", dfT("共 ") + items.length + dfT(" 条"), ""];
  var lastMonth = "";
  items.forEach(function (it) {
    var day = orcaToolsItemDay(it);
    var month = day ? day.slice(0, 7) : "";
    if (month && month !== lastMonth) {
      lastMonth = month;
      lines.push("", "## " + orcaExportMonthTitle(month), "");
    }
    lines.push("### " + (it.created || day || "") + (it.pinned ? (" [" + dfT("置顶") + "]") : ""));
    if (it.location) lines.push(dfT("地点：") + it.location);
    var tags = (it.tags || []).filter(function (t) { return t && t !== "日记流"; });
    if (tags.length) lines.push(dfT("标签：") + tags.map(function (t) { return "#" + t; }).join(" "));
    if (it.text) lines.push("", it.text, "");
    (it.images || []).forEach(function (src, i) {
      var cap = (it.imagesMeta && it.imagesMeta[i]) || (dfT("图") + (i + 1));
      lines.push("![" + cap + "](" + src + ")");
    });
    if (it.comments && it.comments.length) {
      it.comments.forEach(function (c) {
        lines.push("> " + (c.name || dfT("我")) + ": " + (c.text || ""));
      });
    }
    lines.push("");
  });
  return lines.join("\n");
}

/** 按最大宽度把 dataURL 缩为 JPEG（用于导出，减小体积） */
function orcaToolsCompressDataUrl(dataUrl, maxWidth) {
  if (!maxWidth || typeof dataUrl !== "string" || dataUrl.indexOf("data:image/") !== 0) {
    return Promise.resolve(dataUrl);
  }
  return new Promise(function (resolve) {
    try {
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth || img.width || 0;
          var h = img.naturalHeight || img.height || 0;
          if (!w || w <= maxWidth) { resolve(dataUrl); return; }
          var scale = maxWidth / w;
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          var c = document.createElement("canvas");
          c.width = cw; c.height = ch;
          var cx = c.getContext("2d");
          cx.fillStyle = "#fff";
          cx.fillRect(0, 0, cw, ch);
          cx.drawImage(img, 0, 0, cw, ch);
          resolve(c.toDataURL("image/jpeg", 0.82));
        } catch (e) { resolve(dataUrl); }
      };
      img.onerror = function () { resolve(dataUrl); };
      img.src = dataUrl;
    } catch (e) { resolve(dataUrl); }
  });
}

/** Word(.doc) 导出：自实现 HTML，图片尽力转 dataURL（dfasset / file://）并按设置压缩 */
async function orcaToolsImageToDataUrl(src) {
  if (typeof src !== "string" || !src) return src;
  var maxWidth = dfGetExportImageMaxWidth();
  var dataUrl = src;
  if (!/^data:/i.test(src)) {
    try {
      if (src.indexOf("dfasset:") === 0 && globalThis.__DF_ASSETS && typeof globalThis.__DF_ASSETS.toDataUrl === "function") {
        dataUrl = (await globalThis.__DF_ASSETS.toDataUrl(src)) || src;
      } else if (/^file:/i.test(src)) {
        var resp = await fetch(src);
        var blob = await resp.blob();
        dataUrl = await new Promise(function (resolve, reject) {
          var fr = new FileReader();
          fr.onload = function () { resolve(fr.result); };
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });
      }
    } catch (e) { /* ignore, fallback src */ }
  }
  if (maxWidth) dataUrl = await orcaToolsCompressDataUrl(dataUrl, maxWidth);
  return dataUrl;
}

async function orcaToolsBuildWordHtml(items, cfg) {
  cfg = cfg || {};
  var out = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i] || {};
    var meta = [];
    if (it.location) meta.push(it.location);
    var tags = (it.tags || []).filter(function (t) { return t && t !== "日记流"; });
    if (tags.length) meta.push(tags.map(function (t) { return "#" + t; }).join(" "));
    var imgs = "";
    var srcs = (it.images || []).filter(Boolean);
    for (var j = 0; j < srcs.length; j++) {
      var ds = await orcaToolsImageToDataUrl(srcs[j]);
      var cap = it.imagesMeta && it.imagesMeta[j] ? String(it.imagesMeta[j]).trim() : "";
      imgs += '<div style="margin:6px 0"><img src="' + orcaToolsEsc(ds) + '" style="max-width:100%">' +
        (cap ? ('<div style="color:#888;font-size:12px">' + orcaToolsEsc(cap) + "</div>") : "") + "</div>";
    }
    var cmts = (it.comments || []).map(function (c) {
      return orcaToolsEsc((c && c.name) || dfT("我")) + "：" + orcaToolsEsc((c && c.text) || "");
    }).join("<br>");
    out.push(
      '<div style="margin:0 0 18px">' +
      '<div style="color:#666">' + orcaToolsEsc(it.created || "") + "</div>" +
      (meta.length ? ('<div style="color:#888">' + orcaToolsEsc(meta.join(" · ")) + "</div>") : "") +
      '<div style="white-space:pre-wrap">' + orcaToolsEsc(it.text || "") + "</div>" +
      imgs +
      (cmts ? ('<div style="background:#f2f2f2;padding:6px 8px;margin-top:6px">' + cmts + "</div>") : "") +
      "</div>"
    );
  }
  var title = cfg.nickname || dfT("日记流");
  return "<html><head><meta charset=\"utf-8\"><title>" + orcaToolsEsc(title) + "</title></head><body><h1>" +
    orcaToolsEsc(title) + "</h1>" + out.join("\n") + "</body></html>";
}

/** 打开打印窗口（另存为 PDF）；失败返回 false，调用方可回退下载 HTML */
function orcaToolsPrintHtml(html) {
  try {
    var w = window.open("", "_blank");
    if (!w) return false;
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(function () {
      try { w.focus(); w.print(); } catch (e) { /* ignore */ }
    }, 300);
    return true;
  } catch (e) {
    return false;
  }
}

function orcaToolsDownloadBlob(filename, blob) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    try { URL.revokeObjectURL(url); } catch (e) {}
    a.remove();
  }, 1500);
}

function orcaToolsDownloadText(filename, text, mime) {
  orcaToolsDownloadBlob(filename, new Blob([text], { type: mime || "text/plain;charset=utf-8" }));
}

function orcaToolsCrc32(buf) {
  var table = orcaToolsCrc32._t;
  if (!table) {
    table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    orcaToolsCrc32._t = table;
  }
  var crc = 0xffffffff;
  for (var i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function orcaToolsUtf8(str) {
  return new TextEncoder().encode(String(str || ""));
}

/** MS-DOS 时间/日期（ZIP 必填；全 0 会显示成 1601/1/1） */
function orcaToolsZipDosTime(date) {
  var d = date instanceof Date ? date : new Date(date || Date.now());
  if (isNaN(d.getTime())) d = new Date();
  var year = d.getFullYear();
  if (year < 1980) year = 1980;
  if (year > 2107) year = 2107;
  var dosTime = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31);
  var dosDate = (((year - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
  return { time: dosTime, date: dosDate };
}

function orcaToolsZipStore(files) {
  // 无压缩 ZIP（STORE）；GP bit11=UTF-8 文件名，避免 WinRAR 中文乱码
  var parts = [];
  var central = [];
  var offset = 0;
  var FLAG_UTF8 = 0x0800;
  function u16(n) { return new Uint8Array([n & 255, (n >>> 8) & 255]); }
  function u32(n) {
    return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
  }
  function concat(arrs) {
    var len = 0;
    arrs.forEach(function (a) { len += a.length; });
    var out = new Uint8Array(len);
    var p = 0;
    arrs.forEach(function (a) { out.set(a, p); p += a.length; });
    return out;
  }
  var nowDos = orcaToolsZipDosTime(new Date());
  files.forEach(function (f) {
    var name = orcaToolsUtf8(f.name || "file.md");
    var data = typeof f.data === "string" ? orcaToolsUtf8(f.data) : (f.data || new Uint8Array(0));
    var crc = orcaToolsCrc32(data);
    var dos = f.mtime ? orcaToolsZipDosTime(f.mtime) : nowDos;
    var local = concat([
      u32(0x04034b50), u16(20), u16(FLAG_UTF8), u16(0), u16(dos.time), u16(dos.date),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0),
      name, data
    ]);
    parts.push(local);
    central.push(concat([
      u32(0x02014b50), u16(20), u16(20), u16(FLAG_UTF8), u16(0), u16(dos.time), u16(dos.date),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), name
    ]));
    offset += local.length;
  });
  var centralBlob = concat(central);
  var end = concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralBlob.length), u32(offset), u16(0)
  ]);
  return concat(parts.concat([centralBlob, end]));
}

async function orcaToolsLoadItems(opts) {
  opts = opts || {};
  if (!OrcaBlocks) return [];
  var feed = await OrcaBlocks.listFeed({
    kw: opts.kw || "",
    tags: opts.tags || [],
    skipHeal: true,
    preferLive: true,
    fullText: opts.fullText !== false
  });
  var items = feed.items || [];
  if (opts.applyQuick && opts.filters) {
    items = orcaToolsQuickFilterItems(items, opts.filters);
  }
  return items;
}

function orcaToolsCloseBackdrop(sel) {
  var old = document.querySelector(sel);
  if (old) old.remove();
}

function orcaToolsBindEsc(closeFn) {
  function onKey(e) {
    if (e.key === "Escape") {
      closeFn();
      document.removeEventListener("keydown", onKey, true);
    }
  }
  document.addEventListener("keydown", onKey, true);
  return onKey;
}

function orcaCloseToolsDialog() {
  orcaToolsCloseBackdrop(".orca-df-tools-backdrop");
}

function orcaOpenToolsHub(ctx) {
  orcaCloseToolsDialog();
  var host = document.createElement("div");
  host.className = "orca-df-tools-backdrop orca-df-scope";
  host.innerHTML =
    '<div class="orca-df-tools-pop" role="dialog" aria-label="日记流工具">' +
    '<div class="orca-df-tools-head"><span>工具</span>' +
    '<button type="button" class="orca-df-tools-close" data-df-tools="close" aria-label="关闭">×</button></div>' +
    '<div class="orca-df-tools-body">' +
    '<button type="button" class="orca-df-tools-tile" data-df-tools="archive"><b>归档柜</b><span data-df-tools-arch-hint>已归档条目</span></button>' +
    '<button type="button" class="orca-df-tools-tile" data-df-tools="trash"><b>回收站</b><span data-df-tools-trash-hint>删除后约保留 30 天</span></button>' +
    '<button type="button" class="orca-df-tools-tile" data-df-tools="search"><b>搜索</b><span>在日记流内按关键词筛选</span></button>' +
    '<button type="button" class="orca-df-tools-tile" data-df-tools="stats"><b>统计</b><span>年/月计数、连续打卡、标签分布</span></button>' +
    '<button type="button" class="orca-df-tools-tile" data-df-tools="export"><b>导出</b><span>Markdown / 按月 zip / JSON 备份</span></button>' +
    '<button type="button" class="orca-df-tools-tile" data-df-tools="recap"><b>回顾</b><span>去年今日、随机一条</span></button>' +
    '<button type="button" class="orca-df-tools-tile" data-df-tools="layout"><b>布局</b><span>封面高度：紧凑 / 舒适 / 高封面</span></button>' +
    '<button type="button" class="orca-df-tools-tile" data-df-tools="cleanup"><b>清理图片</b><span>移除未引用的插件图片</span></button>' +
    '<button type="button" class="orca-df-tools-tile" data-df-tools="backup"><b>备份与恢复</b><span>导出 / 恢复 JSON 备份</span></button>' +
    '<button type="button" class="orca-df-tools-tile" data-df-tools="tags"><b>标签重命名</b><span>批量改名 / 合并 / 删除标签</span></button>' +
    "</div></div>";
  dfMountDialog(host);
  var archHint = host.querySelector("[data-df-tools-arch-hint]");
  var trashHint = host.querySelector("[data-df-tools-trash-hint]");
  if (OrcaBlocks && typeof OrcaBlocks.listArchivedFeed === "function") {
    OrcaBlocks.listArchivedFeed({ skipHeal: true }).then(function (feed) {
      var n = (feed && feed.items && feed.items.length) || 0;
      if (archHint) archHint.textContent = n ? (dfT("共 ") + n + dfT(" 条已归档")) : dfT("暂无归档");
    }).catch(function () {});
  }
  if (OrcaBlocks && typeof OrcaBlocks.trashCount === "function") {
    OrcaBlocks.trashCount().then(function (n) {
      if (trashHint) {
        trashHint.textContent = n
          ? (dfLocaleIsEn()
            ? ("Total " + n + " · kept about " + dfTrashRetentionDays() + " days")
            : ("共 " + n + " 条 · 约保留 " + dfTrashRetentionDays() + " 天"))
          : dfT("回收站为空");
      }
    }).catch(function () {});
  }
  host.addEventListener("mousedown", function (e) {
    if (e.target === host) orcaCloseToolsDialog();
  });
  host.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-df-tools]");
    if (!btn || !host.contains(btn)) return;
    var act = btn.getAttribute("data-df-tools");
    if (act === "close") { orcaCloseToolsDialog(); return; }
    orcaCloseToolsDialog();
    if (act === "archive") orcaOpenArchiveDialog(ctx);
    else if (act === "trash") orcaOpenTrashDialog(ctx);
    else if (act === "stats") orcaOpenStatsDialog(ctx);
    else if (act === "export") orcaOpenExportDialog(ctx);
    else if (act === "recap") orcaOpenRecapDialog(ctx);
    else if (act === "search") orcaOpenSearchDialog(ctx);
    else if (act === "layout") orcaOpenLayoutDialog(ctx);
    else if (act === "cleanup") orcaOpenMediaCleanupDialog(ctx);
    else if (act === "backup") orcaOpenBackupDialog(ctx);
    else if (act === "tags") orcaOpenTagRenameDialog(ctx);
  });
  orcaToolsBindEsc(orcaCloseToolsDialog);
}

function orcaOpenStatsDialog(ctx) {
  orcaCloseToolsDialog();
  var host = document.createElement("div");
  host.className = "orca-df-tools-backdrop orca-df-scope";
  host.innerHTML =
    '<div class="orca-df-tools-pop orca-df-tools-wide" role="dialog" aria-label="日记流统计">' +
    '<div class="orca-df-tools-head"><span>统计</span>' +
    '<button type="button" class="orca-df-tools-close" data-df-tools="close" aria-label="关闭">×</button></div>' +
    '<div class="orca-df-tools-body"><div class="orca-df-tools-muted">加载中…</div></div></div>';
  dfMountDialog(host);
  var body = host.querySelector(".orca-df-tools-body");
  host.addEventListener("mousedown", function (e) {
    if (e.target === host) orcaCloseToolsDialog();
  });
  host.addEventListener("click", function (e) {
    if (e.target.closest("[data-df-tools=close]")) orcaCloseToolsDialog();
  });
  orcaToolsBindEsc(orcaCloseToolsDialog);
  orcaToolsLoadItems({ fullText: false }).then(function (items) {
    var s = orcaToolsComputeStats(items);
    function cardsHtml(rows, labelFn) {
      if (!rows || !rows.length) return '<div class="orca-df-tools-muted">' + dfT("暂无") + "</div>";
      return '<div class="orca-df-stats-grid">' + rows.map(function (r) {
        return '<div class="orca-df-stats-card"><div class="orca-df-stats-n">' + r.count +
          '</div><div class="orca-df-stats-l">' + orcaToolsEsc(labelFn(r)) + "</div></div>";
      }).join("") + "</div>";
    }
    body.innerHTML =
      '<div class="orca-df-stats-grid">' +
      '<div class="orca-df-stats-card"><div class="orca-df-stats-n">' + s.total + '</div><div class="orca-df-stats-l">' + dfT("全部") + "</div></div>" +
      '<div class="orca-df-stats-card"><div class="orca-df-stats-n">' + s.yearCount + '</div><div class="orca-df-stats-l">' + dfT("今年") + "</div></div>" +
      '<div class="orca-df-stats-card"><div class="orca-df-stats-n">' + s.monthCount + '</div><div class="orca-df-stats-l">' + dfT("本月") + "</div></div>" +
      '<div class="orca-df-stats-card"><div class="orca-df-stats-n">' + s.streak + '</div><div class="orca-df-stats-l">' + dfT("连续打卡（天）") + "</div></div>" +
      '<div class="orca-df-stats-card"><div class="orca-df-stats-n">' + s.activeDays + '</div><div class="orca-df-stats-l">' + dfT("有记录天数") + "</div></div>" +
      '<div class="orca-df-stats-card"><div class="orca-df-stats-n">' + s.withImg + '</div><div class="orca-df-stats-l">' + dfT("含图") + "</div></div>" +
      '<div class="orca-df-stats-card"><div class="orca-df-stats-n">' + s.withLoc + '</div><div class="orca-df-stats-l">' + dfT("含地点") + "</div></div>" +
      '<div class="orca-df-stats-card"><div class="orca-df-stats-n">' + s.pinned + '</div><div class="orca-df-stats-l">' + dfT("置顶") + "</div></div>" +
      "</div>" +
      '<div class="orca-df-tools-sec"><div class="orca-df-tools-sec-t">' + dfT("年份") + "</div>" +
      cardsHtml(s.yearRows, function (r) { return r.year + (dfLocaleIsEn() ? "" : " 年"); }) +
      "</div>" +
      '<div class="orca-df-tools-sec"><div class="orca-df-tools-sec-t">' + dfT("近月") + "</div>" +
      cardsHtml(s.monthRows, function (r) {
        var m = String(r.month || "").match(/^(\d{4})-(\d{2})$/);
        if (!m) return r.month;
        if (dfLocaleIsEn()) return DF_I18N_MONTHS[Number(m[2]) - 1] + " " + m[1];
        return m[1] + "年" + Number(m[2]) + "月";
      }) +
      "</div>" +
      '<div class="orca-df-tools-sec"><div class="orca-df-tools-sec-t">' + dfT("标签分布") + "</div>" +
      (s.tagRows.map(function (r) {
        return '<div class="orca-df-tools-row"><span>#' + orcaToolsEsc(r.tag) + '</span><b>' + r.count + '</b></div>';
      }).join("") || '<div class="orca-df-tools-muted">' + dfT("暂无用户标签") + "</div>") +
      "</div>";
  }).catch(function () {
    body.innerHTML = '<div class="orca-df-tools-muted">' + dfT("加载失败") + "</div>";
  });
}

function orcaOpenExportDialog(ctx) {
  orcaCloseToolsDialog();
  var host = document.createElement("div");
  host.className = "orca-df-tools-backdrop orca-df-scope";
  host.innerHTML =
    '<div class="orca-df-tools-pop" role="dialog" aria-label="导出日记流">' +
    '<div class="orca-df-tools-head"><span>导出</span>' +
    '<button type="button" class="orca-df-tools-close" data-df-tools="close" aria-label="关闭">×</button></div>' +
    '<div class="orca-df-tools-body">' +
    '<p class="orca-df-tools-muted">导出会拉取全文；按月 zip 为无压缩 Markdown 包。</p>' +
    '<button type="button" class="orca-df-tools-btn" data-df-exp="md-all">导出全部 Markdown</button>' +
    '<button type="button" class="orca-df-tools-btn" data-df-exp="md-filter">导出当前筛选 Markdown</button>' +
    '<button type="button" class="orca-df-tools-btn" data-df-exp="zip-month">按月打包 zip</button>' +
    '<button type="button" class="orca-df-tools-btn" data-df-exp="word">导出 Word（.doc）</button>' +
    '<button type="button" class="orca-df-tools-btn" data-df-exp="pdf">打印 / 另存为 PDF</button>' +
    '<button type="button" class="orca-df-tools-btn" data-df-exp="json">导出 JSON 备份</button>' +
    '<div class="orca-df-tools-status" hidden></div>' +
    "</div></div>";
  dfMountDialog(host);
  var status = host.querySelector(".orca-df-tools-status");
  var busy = false;
  function setStatus(t) {
    status.hidden = !t;
    status.textContent = t || "";
  }
  host.addEventListener("mousedown", function (e) {
    if (e.target === host) orcaCloseToolsDialog();
  });
  host.addEventListener("click", function (e) {
    var close = e.target.closest("[data-df-tools=close]");
    if (close) { orcaCloseToolsDialog(); return; }
    var btn = e.target.closest("[data-df-exp]");
    if (!btn || busy) return;
    var act = btn.getAttribute("data-df-exp");
    busy = true;
    setStatus(dfT("准备中…"));
    var filters = (ctx && ctx.filters) || {};
    var useFilter = act === "md-filter";
    orcaToolsLoadItems({
      kw: useFilter ? (filters.kw || "") : "",
      tags: useFilter ? (filters.tags || []) : [],
      filters: filters,
      applyQuick: useFilter,
      fullText: true
    }).then(function (items) {
      var cfg = (ctx && ctx.data && ctx.data().config) || {};
      if (act === "md-all" || act === "md-filter") {
        orcaToolsDownloadText(
          orcaExportBase() + "_" + (act === "md-filter" ? (dfLocaleIsEn() ? "filtered_" : "筛选_") : "") + Date.now() + ".md",
          orcaToolsBuildMarkdown(items, cfg),
          "text/markdown;charset=utf-8"
        );
        setStatus(dfT("已下载 ") + items.length + dfT(" 条 Markdown"));
        orcaShowMessage("已导出 Markdown（" + items.length + " 条）");
        return;
      }
      if (act === "json") {
        orcaToolsDownloadText(
          orcaExportBase() + "_backup_" + Date.now() + ".json",
          JSON.stringify({ exportedAt: new Date().toISOString(), config: cfg, items: items }, null, 2),
          "application/json;charset=utf-8"
        );
        setStatus(dfT("已下载 JSON（") + items.length + dfT(" 条）"));
        orcaShowMessage("已导出 JSON 备份");
        return;
      }
      if (act === "zip-month") {
        var groups = {};
        items.forEach(function (it) {
          var day = orcaToolsItemDay(it);
          var key = day ? day.slice(0, 7) : "unknown";
          (groups[key] = groups[key] || []).push(it);
        });
        var files = Object.keys(groups).sort().map(function (k) {
          var mtime = null;
          var m = String(k).match(/^(\d{4})-(\d{2})$/);
          if (m) mtime = new Date(Number(m[1]), Number(m[2]) - 1, 15, 12, 0, 0);
          return {
            name: orcaExportBase() + "_" + k + ".md",
            data: orcaToolsBuildMarkdown(groups[k], cfg),
            mtime: mtime
          };
        });
        if (!files.length) files = [{ name: "empty.md", data: "# " + dfT("日记流") + "\n\n" + dfT("暂无条目") + "\n" }];
        var zip = orcaToolsZipStore(files);
        orcaToolsDownloadBlob(orcaExportBase() + (dfLocaleIsEn() ? "_monthly_" : "_按月_") + Date.now() + ".zip", new Blob([zip], { type: "application/zip" }));
        setStatus(dfT("已打包 ") + files.length + dfT(" 个月份文件"));
        orcaShowMessage("已导出按月 zip");
        return;
      }
      if (act === "word") {
        return orcaToolsBuildWordHtml(items, cfg).then(function (html) {
          orcaToolsDownloadBlob(orcaExportBase() + "_" + Date.now() + ".doc",
            new Blob([html], { type: "application/msword;charset=utf-8" }));
          setStatus(dfT("已导出 Word（") + items.length + dfT(" 条）"));
          orcaShowMessage("已导出 Word");
        });
      }
      if (act === "pdf") {
        return orcaToolsBuildWordHtml(items, cfg).then(function (html) {
          if (orcaToolsPrintHtml(html)) {
            setStatus(dfT("已打开打印（可另存为 PDF）"));
          } else {
            orcaToolsDownloadBlob(orcaExportBase() + "_" + Date.now() + ".html",
              new Blob([html], { type: "text/html;charset=utf-8" }));
            setStatus(dfT("已导出 HTML（可直接打印为 PDF）"));
            orcaShowMessage("已导出 HTML，可打印为 PDF");
          }
        });
      }
    }).catch(function (err) {
      setStatus(dfT("失败：") + String(err && err.message || err));
      orcaShowMessage("导出失败");
    }).then(function () { busy = false; });
  });
  orcaToolsBindEsc(orcaCloseToolsDialog);
}

function orcaOpenRecapDialog(ctx) {
  orcaCloseToolsDialog();
  var host = document.createElement("div");
  host.className = "orca-df-tools-backdrop orca-df-scope";
  host.innerHTML =
    '<div class="orca-df-tools-pop orca-df-tools-wide" role="dialog" aria-label="回顾">' +
    '<div class="orca-df-tools-head"><span>回顾</span>' +
    '<div class="orca-df-tools-head-tools">' +
    '<button type="button" class="orca-df-tools-mini" data-df-recap="last-year">去年今日</button>' +
    '<button type="button" class="orca-df-tools-mini" data-df-recap="random">随机一条</button>' +
    '<button type="button" class="orca-df-tools-close" data-df-tools="close" aria-label="关闭">×</button>' +
    "</div></div>" +
    '<div class="orca-df-tools-body"><div class="orca-df-tools-muted">加载中…</div></div></div>';
  dfMountDialog(host);
  var body = host.querySelector(".orca-df-tools-body");
  var allItems = [];
  function renderList(list, emptyText) {
    if (!list.length) {
      body.innerHTML = '<div class="orca-df-tools-muted">' + orcaToolsEsc(emptyText || dfT("暂无")) + "</div>";
      return;
    }
    body.innerHTML = list.map(function (it) {
      var bid = it.blockId || it.id;
      return (
        '<div class="orca-df-tools-entry">' +
        '<div class="orca-df-tools-entry-main">' +
        '<div class="orca-df-tools-entry-t">' + orcaToolsEsc(orcaToolsItemTitle(it)) + "</div>" +
        '<div class="orca-df-tools-muted">' + orcaToolsEsc(it.created || orcaToolsItemDay(it) || "") +
        (it.location ? (" · " + orcaToolsEsc(it.location)) : "") + "</div></div>" +
        '<button type="button" class="orca-df-tools-mini" data-df-recap="open" data-block-id="' + orcaToolsEsc(String(bid)) + '">' + dfT("打开") + "</button>" +
        "</div>"
      );
    }).join("");
  }
  function lastYearToday() {
    var now = new Date();
    var key = ("0" + (now.getMonth() + 1)).slice(-2) + "-" + ("0" + now.getDate()).slice(-2);
    var y = now.getFullYear() - 1;
    return allItems.filter(function (it) {
      var day = orcaToolsItemDay(it);
      return day && day.slice(0, 4) === String(y) && day.slice(5) === key;
    });
  }
  host.addEventListener("mousedown", function (e) {
    if (e.target === host) orcaCloseToolsDialog();
  });
  host.addEventListener("click", function (e) {
    if (e.target.closest("[data-df-tools=close]")) { orcaCloseToolsDialog(); return; }
    var btn = e.target.closest("[data-df-recap]");
    if (!btn) return;
    var act = btn.getAttribute("data-df-recap");
    if (act === "open") {
      var bid = Number(btn.getAttribute("data-block-id"));
      if (bid && typeof orcaOpenInOrca === "function") orcaOpenInOrca(bid);
      return;
    }
    if (act === "last-year") {
      renderList(lastYearToday(), dfT("去年今日没有日记"));
      return;
    }
    if (act === "random") {
      if (!allItems.length) {
        renderList([], dfT("暂无日记"));
        return;
      }
      var pick = allItems[Math.floor(Math.random() * allItems.length)];
      renderList([pick], "");
    }
  });
  orcaToolsBindEsc(orcaCloseToolsDialog);
  orcaToolsLoadItems({ fullText: false }).then(function (items) {
    allItems = items || [];
    var ly = lastYearToday();
    if (ly.length) renderList(ly, "");
    else renderList([], dfT("去年今日没有日记 — 可点「随机一条」"));
  }).catch(function () {
    body.innerHTML = '<div class="orca-df-tools-muted">' + dfT("加载失败") + "</div>";
  });
}

function orcaOpenSearchDialog(ctx) {
  orcaCloseToolsDialog();
  var host = document.createElement("div");
  host.className = "orca-df-tools-backdrop orca-df-scope";
  var cf = (ctx && ctx.filters) || {};
  var cur = cf.kw || "";
  var curTag = (cf.tags || [])[0] || "";
  host.innerHTML =
    '<div class="orca-df-tools-pop" role="dialog" aria-label="搜索日记流">' +
    '<div class="orca-df-tools-head"><span>搜索</span>' +
    '<button type="button" class="orca-df-tools-close" data-df-tools="close" aria-label="关闭">×</button></div>' +
    '<div class="orca-df-tools-body">' +
    '<label class="orca-df-tools-label">关键词（匹配日记流条目正文）</label>' +
    '<input class="orca-df-tools-input" type="search" data-df-search-input placeholder="例如：旅行 / 心情" value="' + orcaToolsEsc(cur) + '" />' +
    '<label class="orca-df-tools-label">标签</label>' +
    '<select class="orca-df-tools-input" data-df-search-tag><option value="">全部</option></select>' +
    '<label class="orca-df-tools-label">快捷筛选</label>' +
    '<div class="orca-df-search-quick">' +
    '<label class="orca-df-search-check"><input type="checkbox" data-df-search-img' + (cf.hasImage ? " checked" : "") + '> 有图</label>' +
    '<label class="orca-df-search-check"><input type="checkbox" data-df-search-loc' + (cf.hasLocation ? " checked" : "") + '> 有地点</label>' +
    '<label class="orca-df-search-check"><input type="checkbox" data-df-search-pin' + (cf.pinnedOnly ? " checked" : "") + '> 仅置顶</label>' +
    "</div>" +
    '<label class="orca-df-tools-label">日期范围</label>' +
    '<div class="orca-df-search-dates">' +
    '<input class="orca-df-tools-input" type="date" data-df-search-from value="' + orcaToolsEsc(cf.dateFrom || "") + '" />' +
    '<span class="orca-df-tools-muted">—</span>' +
    '<input class="orca-df-tools-input" type="date" data-df-search-to value="' + orcaToolsEsc(cf.dateTo || "") + '" />' +
    "</div>" +
    '<div class="orca-df-tools-actions">' +
    '<button type="button" class="orca-df-tools-btn primary" data-df-search="apply">在日记流中筛选</button>' +
    '<button type="button" class="orca-df-tools-btn" data-df-search="clear">清除筛选</button>' +
    "</div>" +
    '<p class="orca-df-tools-muted">也可使用虎鲸全局搜索；此处仅限带「日记流」标签的条目。</p>' +
    "</div></div>";
  dfMountDialog(host);
  var input = host.querySelector("[data-df-search-input]");
  var tagSel = host.querySelector("[data-df-search-tag]");
  var imgChk = host.querySelector("[data-df-search-img]");
  var locChk = host.querySelector("[data-df-search-loc]");
  var pinChk = host.querySelector("[data-df-search-pin]");
  var fromEl = host.querySelector("[data-df-search-from]");
  var toEl = host.querySelector("[data-df-search-to]");
  if (OrcaBlocks && typeof OrcaBlocks.collectUserTags === "function") {
    OrcaBlocks.collectUserTags().then(function (tags) {
      if (!tagSel || !tagSel.isConnected) return;
      tagSel.innerHTML = '<option value="">' + orcaToolsEsc(dfT("全部")) + "</option>" +
        (tags || []).map(function (t) {
          return '<option value="' + orcaToolsEsc(t) + '"' + (t === curTag ? " selected" : "") + ">#" + orcaToolsEsc(t) + "</option>";
        }).join("");
    }).catch(function () {});
  }
  setTimeout(function () { try { input.focus(); input.select(); } catch (e) {} }, 30);
  host.addEventListener("mousedown", function (e) {
    if (e.target === host) orcaCloseToolsDialog();
  });
  function apply(kw) {
    if (!ctx.filters) ctx.filters = { kw: "", tags: [] };
    ctx.filters.kw = kw || "";
    var tag = tagSel ? String(tagSel.value || "") : "";
    ctx.filters.tags = tag ? [tag] : [];
    ctx.filters.hasImage = !!(imgChk && imgChk.checked);
    ctx.filters.hasLocation = !!(locChk && locChk.checked);
    ctx.filters.pinnedOnly = !!(pinChk && pinChk.checked);
    ctx.filters.dateFrom = fromEl ? String(fromEl.value || "") : "";
    ctx.filters.dateTo = toEl ? String(toEl.value || "") : "";
    if (typeof orcaPersistFilters === "function") orcaPersistFilters();
    orcaCloseToolsDialog();
    orcaRefreshFeed().then(function () {
      if (ctx.reApp) ctx.reApp();
      orcaShowMessage(kw || tag || ctx.filters.hasImage || ctx.filters.hasLocation || ctx.filters.pinnedOnly ||
        ctx.filters.dateFrom || ctx.filters.dateTo
        ? ("已筛选" + (kw ? "：" + kw : ""))
        : "已清除搜索");
    });
  }
  host.addEventListener("click", function (e) {
    if (e.target.closest("[data-df-tools=close]")) { orcaCloseToolsDialog(); return; }
    var btn = e.target.closest("[data-df-search]");
    if (!btn) return;
    var act = btn.getAttribute("data-df-search");
    if (act === "apply") apply(String(input.value || "").trim());
    else if (act === "clear") {
      if (input) input.value = "";
      if (tagSel) tagSel.value = "";
      if (imgChk) imgChk.checked = false;
      if (locChk) locChk.checked = false;
      if (pinChk) pinChk.checked = false;
      if (fromEl) fromEl.value = "";
      if (toEl) toEl.value = "";
      apply("");
    }
  });
  host.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target === input) {
      e.preventDefault();
      apply(String(input.value || "").trim());
    }
  });
  orcaToolsBindEsc(orcaCloseToolsDialog);
}

function orcaToolsLayoutLabel(p) {
  if (p === "compact") return "紧凑";
  if (p === "tall") return "高封面";
  return "舒适";
}

async function orcaToolsGetLayout() {
  try {
    var v = await dfGetData(DF_LAYOUT_KEY);
    if (v === "compact" || v === "tall" || v === "cozy") return v;
  } catch (e) {}
  return DF_LAYOUT_DEFAULT;
}

async function orcaToolsSetLayout(preset) {
  if (preset !== "compact" && preset !== "tall" && preset !== "cozy") preset = DF_LAYOUT_DEFAULT;
  await dfSetData(DF_LAYOUT_KEY, preset);
  return preset;
}

function orcaApplyLayoutToMounts(preset) {
  preset = preset || DF_LAYOUT_DEFAULT;
  (document.querySelectorAll(".orca-df-scope") || []).forEach(function (el) {
    el.classList.remove("orca-df-layout-cozy", "orca-df-layout-compact", "orca-df-layout-tall");
    el.classList.add("orca-df-layout-" + preset);
  });
}

function orcaOpenLayoutDialog(ctx) {
  orcaCloseToolsDialog();
  var host = document.createElement("div");
  host.className = "orca-df-tools-backdrop orca-df-scope";
  host.innerHTML =
    '<div class="orca-df-tools-pop" role="dialog" aria-label="布局预设">' +
    '<div class="orca-df-tools-head"><span>布局</span>' +
    '<button type="button" class="orca-df-tools-close" data-df-tools="close" aria-label="关闭">×</button></div>' +
    '<div class="orca-df-tools-body">' +
    '<p class="orca-df-tools-muted">窄屏可选手「紧凑」缩小封面；宽屏可用「高封面」。</p>' +
    '<button type="button" class="orca-df-tools-btn" data-df-layout="compact">紧凑 — 矮封面、更密列表</button>' +
    '<button type="button" class="orca-df-tools-btn" data-df-layout="cozy">舒适 — 默认</button>' +
    '<button type="button" class="orca-df-tools-btn" data-df-layout="tall">高封面 — 更强氛围</button>' +
    '<div class="orca-df-tools-status" data-df-layout-status></div>' +
    "</div></div>";
  dfMountDialog(host);
  var status = host.querySelector("[data-df-layout-status]");
  orcaToolsGetLayout().then(function (cur) {
    status.textContent = dfT("当前：") + dfT(orcaToolsLayoutLabel(cur));
    host.querySelectorAll("[data-df-layout]").forEach(function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-df-layout") === cur);
    });
  });
  host.addEventListener("mousedown", function (e) {
    if (e.target === host) orcaCloseToolsDialog();
  });
  host.addEventListener("click", function (e) {
    if (e.target.closest("[data-df-tools=close]")) { orcaCloseToolsDialog(); return; }
    var btn = e.target.closest("[data-df-layout]");
    if (!btn) return;
    var preset = btn.getAttribute("data-df-layout");
    orcaToolsSetLayout(preset).then(function (p) {
      orcaApplyLayoutToMounts(p);
      status.textContent = dfT("当前：") + dfT(orcaToolsLayoutLabel(p));
      host.querySelectorAll("[data-df-layout]").forEach(function (b) {
        b.classList.toggle("is-on", b.getAttribute("data-df-layout") === p);
      });
      orcaShowMessage(dfT("布局已设为「") + dfT(orcaToolsLayoutLabel(p)) + dfT("」"));
      if (ctx && ctx.reApp) ctx.reApp();
    });
  });
  orcaToolsBindEsc(orcaCloseToolsDialog);
}

function orcaToolsCollectUsedMedia(items, cfg) {
  var used = {};
  function mark(s) {
    if (typeof s !== "string" || !s) return;
    var m = s.match(/^dfasset:\/\/media\/(.+)$/);
    if (m && m[1]) used[decodeURIComponent(m[1])] = true;
  }
  if (cfg) ["avatar", "cover", "lockBg"].forEach(function (k) { mark(cfg[k]); });
  (items || []).forEach(function (it) {
    if (!it) return;
    (it.images || []).forEach(mark);
  });
  return used;
}

/** 列出未被引用的插件图片（含归档条目与回收站快照引用保护） */
async function orcaToolsListOrphanMedia() {
  if (!globalThis.__DF_ASSETS || typeof globalThis.__DF_ASSETS.listMedia !== "function") return [];
  if (!OrcaBlocks) return [];
  var cfg = (orcaCtx && orcaCtx.data && orcaCtx.data() && orcaCtx.data().config) || {};
  var feed = null;
  try {
    feed = await OrcaBlocks.listFeed({ skipHeal: true, includeArchived: true, preferLive: true });
  } catch (e) {
    return [];
  }
  if (!feed) return [];
  var used = orcaToolsCollectUsedMedia(feed.items || [], cfg);
  try {
    var trefs = (OrcaBlocks.trashAllMediaRefs ? await OrcaBlocks.trashAllMediaRefs() : {}) || {};
    Object.keys(trefs).forEach(function (k) { used[k] = true; });
  } catch (e2) { /* ignore */ }
  var names = await DF_ASSETS.listMedia();
  return (names || []).filter(function (n) { return n && !used[n]; });
}

/** 删除给定插件图片文件，返回成功数 */
async function orcaToolsCleanupOrphanMedia(names) {
  var list = names || [];
  var removed = 0;
  for (var i = 0; i < list.length; i++) {
    try {
      await orca.invokeBackend("remove-plugin-file", orcaPluginName, "media/" + list[i]);
      removed++;
    } catch (e) { /* ignore */ }
  }
  return removed;
}

function orcaOpenMediaCleanupDialog(ctx) {
  orcaCloseToolsDialog();
  if (!globalThis.__DF_ASSETS || typeof globalThis.__DF_ASSETS.listMedia !== "function") {
    orcaShowMessage("无法访问插件图片");
    return;
  }
  var host = document.createElement("div");
  host.className = "orca-df-tools-backdrop orca-df-scope";
  host.innerHTML =
    '<div class="orca-df-tools-pop orca-df-tools-wide" role="dialog" aria-label="清理图片">' +
    '<div class="orca-df-tools-head"><span>清理图片</span>' +
    '<button type="button" class="orca-df-tools-close" data-df-tools="close" aria-label="关闭">×</button></div>' +
    '<div class="orca-df-tools-body">' +
    '<p class="orca-df-tools-muted">仅删除插件图片目录中未被封面/头像/日记条目引用的文件。</p>' +
    '<div class="orca-df-media-list"><div class="orca-df-tools-muted">加载中…</div></div>' +
    '<div class="orca-df-tools-actions">' +
    '<button type="button" class="orca-df-tools-btn primary" data-df-cleanup="run" disabled>清理</button>' +
    "</div></div></div>";
  dfMountDialog(host);
  var listEl = host.querySelector(".orca-df-media-list");
  var runBtn = host.querySelector('[data-df-cleanup="run"]');
  var unused = [];
  var busy = false;

  function render() {
    if (!unused.length) {
      listEl.innerHTML = '<div class="orca-df-tools-muted">没有可清理的图片</div>';
      runBtn.disabled = true;
      return;
    }
    listEl.innerHTML = unused.slice(0, 100).map(function (n) {
      return '<div class="orca-df-tools-row"><span>' + orcaToolsEsc(n) + "</span></div>";
    }).join("") + (unused.length > 100 ? ('<div class="orca-df-tools-muted">+' + (unused.length - 100) + "</div>") : "");
    runBtn.disabled = false;
  }

  function load() {
    return orcaToolsListOrphanMedia().then(function (names) {
      unused = names || [];
      render();
    }).catch(function () {
      listEl.innerHTML = '<div class="orca-df-tools-muted">' + dfT("加载失败") + "</div>";
    });
  }

  host.addEventListener("mousedown", function (e) {
    if (e.target === host) orcaCloseToolsDialog();
  });
  host.addEventListener("click", function (e) {
    if (e.target.closest("[data-df-tools=close]")) { orcaCloseToolsDialog(); return; }
    var btn = e.target.closest("[data-df-cleanup]");
    if (!btn || busy) return;
    if (btn.getAttribute("data-df-cleanup") !== "run") return;
    if (!unused.length) return;
    if (dfGetSetting("confirmDelete") &&
      !window.confirm(dfT("清理未引用图片？共 ") + unused.length + dfT(" 个文件"))) return;
    busy = true;
    btn.disabled = true;
    var names = unused.slice();
    orcaToolsCleanupOrphanMedia(names).then(function (removed) {
      orcaShowMessage(removed ? ("已清理 " + removed + " 个图片") : "没有可清理的图片");
      unused = [];
      busy = false;
      btn.textContent = dfT("清理");
      load();
    }).catch(function () {
      orcaShowMessage("清理失败");
      busy = false;
      btn.disabled = false;
    });
  });
  orcaToolsBindEsc(orcaCloseToolsDialog);
  load();
}

// ---------- 备份与恢复 ----------
async function orcaToolsListBackups() {
  try {
    var r = await orca.invokeBackend("list-plugin-files", orcaPluginName, "backup");
    var arr = Array.isArray(r) ? r : (r && (r.files || r.data));
    if (arr) {
      return arr.map(function (x) { return typeof x === "string" ? x : (x && (x.name || x.path)) || ""; })
        .map(function (n) { return String(n).split("/").pop(); })
        .filter(function (n) { return /\.json$/i.test(n); })
        .sort();
    }
  } catch (e) { /* ignore */ }
  return [];
}

async function orcaToolsBackupData() {
  var feed = await OrcaBlocks.listFeed({ skipHeal: true, includeArchived: true, preferLive: true, fullText: true });
  var cfg = (orcaCtx && orcaCtx.data && orcaCtx.data() && orcaCtx.data().config) || {};
  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    config: cfg,
    items: (feed && feed.items) || []
  };
}

async function orcaToolsPruneBackups() {
  var keep = dfGetNumberSetting("backupKeep", 1);
  var list = await orcaToolsListBackups();
  var removed = 0;
  while (list.length > keep) {
    var name = list.shift();
    try { await orca.invokeBackend("remove-plugin-file", orcaPluginName, "backup/" + name); removed++; } catch (e) { /* ignore */ }
  }
  return removed;
}

async function orcaToolsWriteBackupFile() {
  var data = await orcaToolsBackupData();
  var d = new Date();
  var name = "diaryflow-" + d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2) + ".json";
  var rel = "backup/" + name;
  var raw = JSON.stringify(data);
  try {
    await orca.invokeBackend("set-plugin-file", orcaPluginName, rel, raw);
  } catch (e1) {
    await orca.invokeBackend("set-plugin-file", orcaPluginName, rel, new TextEncoder().encode(raw));
  }
  await orcaToolsPruneBackups();
  return { name: name, count: (data.items || []).length };
}

async function orcaToolsReadBackup(name) {
  var raw = null;
  try { raw = await orca.invokeBackend("get-plugin-file", orcaPluginName, "backup/" + name); } catch (e) { raw = null; }
  if (raw == null) return null;
  if (typeof raw !== "string") {
    try { raw = new TextDecoder().decode(raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw); } catch (e2) { raw = String(raw); }
  }
  try { return JSON.parse(raw); } catch (e3) { return null; }
}

async function orcaToolsImportBackup(data) {
  var items = (data && data.items) || [];
  var n = 0;
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    if (!it) continue;
    var d = it.createdAt ? new Date(it.createdAt) : new Date(String(it.created || "").replace(" ", "T"));
    if (isNaN(d.getTime())) d = new Date();
    try {
      var block = await OrcaBlocks.createEntry({
        date: d,
        text: it.text || "",
        tags: it.tags || [],
        images: it.images || [],
        location: it.location || ""
      });
      var bid = block && (block.id != null ? block.id : block);
      if (bid && (it.mood || it.weather) && OrcaBlocks.updateEntryMeta) {
        try { await OrcaBlocks.updateEntryMeta(bid, { mood: it.mood || "", weather: it.weather || "" }); } catch (eM) { /* ignore */ }
      }
      n++;
    } catch (e) {
      console.warn("[orca-diaryflow] import item failed", i, e);
    }
  }
  return n;
}

function orcaOpenBackupDialog(ctx) {
  orcaCloseToolsDialog();
  var host = document.createElement("div");
  host.className = "orca-df-tools-backdrop orca-df-scope";
  host.innerHTML =
    '<div class="orca-df-tools-pop orca-df-tools-wide" role="dialog" aria-label="备份与恢复">' +
    '<div class="orca-df-tools-head"><span>备份与恢复</span>' +
    '<button type="button" class="orca-df-tools-close" data-df-tools="close" aria-label="关闭">×</button></div>' +
    '<div class="orca-df-tools-body">' +
    '<p class="orca-df-tools-muted">备份保存到插件备份目录（JSON）。恢复会新增条目，不改动现有数据。</p>' +
    '<div class="orca-df-tools-actions">' +
    '<button type="button" class="orca-df-tools-btn primary" data-df-bak="now">立即备份</button>' +
    '<button type="button" class="orca-df-tools-btn" data-df-bak="import-file">从文件导入</button>' +
    "</div>" +
    '<input type="file" accept="application/json,.json" hidden data-df-bak-file />' +
    '<div class="orca-df-bak-list"><div class="orca-df-tools-muted">加载中…</div></div>' +
    '<div class="orca-df-tools-status" data-df-bak-status hidden></div>' +
    "</div></div>";
  dfMountDialog(host);
  var listEl = host.querySelector(".orca-df-bak-list");
  var statusEl = host.querySelector("[data-df-bak-status]");
  var fileInput = host.querySelector("[data-df-bak-file]");
  var busy = false;

  function setStatus(t) {
    if (!statusEl) return;
    statusEl.hidden = !t;
    statusEl.textContent = t || "";
  }
  async function refresh() {
    var names = await orcaToolsListBackups();
    if (!names.length) { listEl.innerHTML = '<div class="orca-df-tools-muted">暂无备份</div>'; return; }
    listEl.innerHTML = names.slice().reverse().map(function (n) {
      return '<div class="orca-df-tools-row"><span>' + orcaToolsEsc(n) + "</span>" +
        '<button type="button" class="orca-df-tools-btn" data-df-bak="restore" data-name="' + orcaToolsEsc(n) + '">恢复</button></div>';
    }).join("");
  }
  function doImport(data) {
    if (!data || !Array.isArray(data.items)) { setStatus(dfT("导入失败")); return; }
    var cnt = data.items.length;
    if (dfGetSetting("confirmDelete") && !window.confirm(dfT("恢复该备份？将新增 ") + cnt + dfT(" 条"))) return;
    busy = true;
    setStatus(dfT("正在恢复…"));
    orcaToolsImportBackup(data).then(function (n) {
      setStatus(dfT("已恢复 ") + n + dfT(" 条"));
      orcaShowMessage("已恢复 " + n + " 条");
      return orcaRefreshFeed({ skipHeal: true, preferLive: true });
    }).then(function () {
      if (ctx && ctx.reApp) ctx.reApp();
      busy = false;
    }).catch(function () {
      setStatus(dfT("恢复失败"));
      busy = false;
    });
  }
  host.addEventListener("mousedown", function (e) { if (e.target === host) orcaCloseToolsDialog(); });
  host.addEventListener("click", function (e) {
    if (e.target.closest("[data-df-tools=close]")) { orcaCloseToolsDialog(); return; }
    var btn = e.target.closest("[data-df-bak]");
    if (!btn || busy) return;
    var act = btn.getAttribute("data-df-bak");
    if (act === "now") {
      busy = true;
      setStatus(dfT("正在备份…"));
      orcaToolsWriteBackupFile().then(function (r) {
        setStatus(dfT("已备份 ") + r.count + dfT(" 条"));
        orcaShowMessage("已备份");
        return refresh();
      }).catch(function () { setStatus(dfT("备份失败")); }).then(function () { busy = false; });
    } else if (act === "import-file") {
      fileInput.click();
    } else if (act === "restore") {
      var name = btn.getAttribute("data-name");
      busy = true;
      setStatus(dfT("读取中…"));
      orcaToolsReadBackup(name).then(function (data) {
        busy = false;
        doImport(data);
      }).catch(function () { busy = false; setStatus(dfT("读取失败")); });
    }
  });
  fileInput.addEventListener("change", function () {
    var f = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      var data = null;
      try { data = JSON.parse(String(fr.result || "")); } catch (e) { data = null; }
      doImport(data);
    };
    fr.onerror = function () { setStatus(dfT("导入失败")); };
    fr.readAsText(f);
  });
  orcaToolsBindEsc(orcaCloseToolsDialog);
  refresh();
}

var DF_CARD_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";

function orcaToolsWrapText(ctx, text, maxWidth, font) {
  ctx.font = font;
  var out = [];
  String(text || "").split("\n").forEach(function (para) {
    if (!para) { out.push(""); return; }
    var line = "";
    for (var i = 0; i < para.length; i++) {
      var ch = para[i];
      var test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    out.push(line);
  });
  return out;
}

function orcaToolsLoadImage(src) {
  return new Promise(function (resolve, reject) {
    var im = new Image();
    im.onload = function () { resolve(im); };
    im.onerror = function () { reject(new Error("image load failed")); };
    im.src = src;
  });
}

function orcaToolsRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 把一条日记渲染成分享图片（PNG 下载） */
async function orcaToolsShareEntry(item, cfg) {
  if (!item) return false;
  var pad = 26, W = 620, dpr = 2;
  var bodyFont = "15px " + DF_CARD_FONT;
  var srcs = (item.images || []).slice(0, 9);
  var imgs = [];
  for (var i = 0; i < srcs.length; i++) {
    try {
      var ds = await orcaToolsImageToDataUrl(srcs[i]);
      var im = await orcaToolsLoadImage(ds);
      imgs.push({ el: im, cap: (item.imagesMeta && item.imagesMeta[i]) || "" });
    } catch (e) { /* skip unloadable */ }
  }
  var measure = document.createElement("canvas").getContext("2d");
  var contentW = W - pad * 2;
  var lines = orcaToolsWrapText(measure, item.text || "", contentW, bodyFont);
  var metaBits = [];
  if (item.mood) metaBits.push(item.mood);
  if (item.weather) metaBits.push(item.weather);
  if (item.location) metaBits.push(item.location);
  var imgBlocks = [];
  for (var k = 0; k < imgs.length; k++) {
    var el = imgs[k].el;
    var iw = el.naturalWidth || el.width || 1;
    var ih = el.naturalHeight || el.height || 1;
    var w = contentW, h = Math.round(w * ih / iw);
    if (h > 520) { h = 520; w = Math.round(h * iw / ih); }
    imgBlocks.push({ w: w, h: h, el: el, cap: imgs[k].cap });
  }
  var tags = (item.tags || []).filter(function (t) { return t && t !== "日记流"; });
  var headerH = 56;
  var metaH = metaBits.length ? 24 : 0;
  var bodyH = lines.length * 24;
  var imgsH = imgBlocks.reduce(function (s, b) { return s + b.h + (b.cap ? 22 : 0) + 12; }, 0);
  var footerH = (tags.length ? 26 : 0) + (item.comments && item.comments.length ? 22 : 0) + 8;
  var totalH = pad + headerH + metaH + bodyH + imgsH + footerH + pad;
  var canvas = document.createElement("canvas");
  canvas.width = W * dpr;
  canvas.height = totalH * dpr;
  var ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, totalH);
  var cy = pad;
  ctx.fillStyle = "#111111";
  ctx.font = "bold 19px " + DF_CARD_FONT;
  ctx.fillText(String((cfg && cfg.nickname) || dfT("日记流")), pad, cy);
  ctx.fillStyle = "#8e8e93";
  ctx.font = "13px " + DF_CARD_FONT;
  ctx.textAlign = "right";
  ctx.fillText(String(item.created || ""), W - pad, cy + 5);
  ctx.textAlign = "left";
  cy += headerH;
  if (metaBits.length) {
    ctx.fillStyle = "#6b7280";
    ctx.font = "14px " + DF_CARD_FONT;
    ctx.fillText(metaBits.join("  ·  "), pad, cy);
    cy += metaH;
  }
  ctx.fillStyle = "#222222";
  ctx.font = bodyFont;
  for (var l = 0; l < lines.length; l++) { ctx.fillText(lines[l], pad, cy); cy += 24; }
  for (var b = 0; b < imgBlocks.length; b++) {
    var blk = imgBlocks[b];
    var bx = pad + Math.max(0, Math.round((contentW - blk.w) / 2));
    try {
      orcaToolsRoundRect(ctx, bx, cy, blk.w, blk.h, 10);
      ctx.save(); ctx.clip(); ctx.drawImage(blk.el, bx, cy, blk.w, blk.h); ctx.restore();
    } catch (eDraw) { /* ignore */ }
    cy += blk.h;
    if (blk.cap) {
      ctx.fillStyle = "#8e8e93";
      ctx.font = "12px " + DF_CARD_FONT;
      ctx.fillText(blk.cap, pad, cy + 4);
      cy += 22;
    }
    cy += 12;
  }
  if (tags.length) {
    ctx.fillStyle = "#2563eb";
    ctx.font = "13px " + DF_CARD_FONT;
    ctx.fillText(tags.map(function (t) { return "#" + t; }).join("  "), pad, cy);
    cy += 26;
  }
  if (item.comments && item.comments.length) {
    ctx.fillStyle = "#8e8e93";
    ctx.font = "13px " + DF_CARD_FONT;
    ctx.fillText(dfT("评论") + " · " + item.comments.length, pad, cy);
  }
  return await new Promise(function (resolve) {
    try {
      canvas.toBlob(function (blob) {
        if (!blob) { resolve(false); return; }
        var d = item.createdAt ? new Date(item.createdAt) : new Date();
        var fn = "diaryflow-" + d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2) +
          "-" + String(item.id).slice(-4) + ".png";
        orcaToolsDownloadBlob(fn, blob);
        resolve(true);
      }, "image/png");
    } catch (e) {
      resolve(false);
    }
  });
}

function orcaOpenTagRenameDialog(ctx) {
  orcaCloseToolsDialog();
  var host = document.createElement("div");
  host.className = "orca-df-tools-backdrop orca-df-scope";
  host.innerHTML =
    '<div class="orca-df-tools-pop" role="dialog" aria-label="标签重命名">' +
    '<div class="orca-df-tools-head"><span>标签重命名</span>' +
    '<button type="button" class="orca-df-tools-close" data-df-tools="close" aria-label="关闭">×</button></div>' +
    '<div class="orca-df-tools-body">' +
    '<p class="orca-df-tools-muted">把一个用户标签在所有条目中改为新标签；新标签留空则删除该标签。</p>' +
    '<label class="orca-df-tools-label">原标签</label>' +
    '<select class="orca-df-tools-input" data-tr-from><option value="">加载中…</option></select>' +
    '<label class="orca-df-tools-label">新标签（留空则删除）</label>' +
    '<input type="text" class="orca-df-tools-input" data-tr-to placeholder="新标签名" maxlength="40" />' +
    '<div class="orca-df-tools-actions">' +
    '<button type="button" class="orca-df-tools-btn primary" data-tr="apply">应用</button>' +
    "</div>" +
    '<div class="orca-df-tools-status" data-tr-status hidden></div>' +
    "</div></div>";
  dfMountDialog(host);
  var fromSel = host.querySelector("[data-tr-from]");
  var toInp = host.querySelector("[data-tr-to]");
  var statusEl = host.querySelector("[data-tr-status]");
  var busy = false;
  function setStatus(t) { statusEl.hidden = !t; statusEl.textContent = t || ""; }
  OrcaBlocks.collectUserTags().then(function (tags) {
    if (!fromSel || !fromSel.isConnected) return;
    fromSel.innerHTML = '<option value="">—</option>' +
      (tags || []).map(function (t) { return '<option value="' + orcaToolsEsc(t) + '">#' + orcaToolsEsc(t) + "</option>"; }).join("");
  }).catch(function () { if (fromSel) fromSel.innerHTML = '<option value="">—</option>'; });
  host.addEventListener("mousedown", function (e) { if (e.target === host) orcaCloseToolsDialog(); });
  host.addEventListener("click", function (e) {
    if (e.target.closest("[data-df-tools=close]")) { orcaCloseToolsDialog(); return; }
    var btn = e.target.closest('[data-tr="apply"]');
    if (!btn || busy) return;
    var from = fromSel ? String(fromSel.value || "") : "";
    var to = toInp ? String(toInp.value || "").replace(/^#/, "").trim() : "";
    if (!from) { setStatus(dfT("请选择原标签")); return; }
    if (to === from) { setStatus(dfT("新标签与原标签相同")); return; }
    if (dfGetSetting("confirmDelete") && !window.confirm(dfT("将 #") + from + dfT(" 改为 ") + (to ? "#" + to : dfT("（删除）")) + "?")) return;
    busy = true;
    btn.disabled = true;
    setStatus(dfT("正在处理…"));
    OrcaBlocks.listFeed({ skipHeal: true, includeArchived: true, preferLive: true, fullText: false }).then(async function (feed) {
      var items = (feed && feed.items) || [];
      var targets = items.filter(function (it) { return (it.tags || []).indexOf(from) >= 0; });
      var done = 0;
      for (var i = 0; i < targets.length; i++) {
        var it = targets[i];
        var next = (it.tags || []).filter(function (t) { return t !== from; });
        if (to && next.indexOf(to) < 0) next.push(to);
        try { await OrcaBlocks.updateEntryTags(it.blockId || it.id, next); done++; } catch (e) { /* ignore */ }
        btn.textContent = dfT("应用") + " " + done + "/" + targets.length;
      }
      setStatus(dfT("已处理 ") + done + dfT(" 条"));
      return orcaRefreshFeed({ skipHeal: true, preferLive: true });
    }).then(function () {
      if (ctx && ctx.reApp) ctx.reApp();
    }).catch(function () {
      setStatus(dfT("处理失败"));
    }).then(function () {
      busy = false;
      btn.disabled = false;
      btn.textContent = dfT("应用");
      OrcaBlocks.collectUserTags().then(function (tags) {
        if (!fromSel || !fromSel.isConnected) return;
        fromSel.innerHTML = '<option value="">—</option>' +
          (tags || []).map(function (t) { return '<option value="' + orcaToolsEsc(t) + '">#' + orcaToolsEsc(t) + "</option>"; }).join("");
      });
    });
  });
  orcaToolsBindEsc(orcaCloseToolsDialog);
}

function orcaCloseImagesDialog() {
  orcaToolsCloseBackdrop(".orca-df-images-backdrop");
  if (orcaImagesBlobUrls.length) {
    orcaImagesBlobUrls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) { /* ignore */ } });
    orcaImagesBlobUrls = [];
  }
}

function orcaOpenImagesDialog(ctx, item) {
  if (!item || !OrcaBlocks) {
    orcaShowMessage("找不到条目");
    return;
  }
  orcaCloseImagesDialog();
  var bid = item.blockId || item.id;
  var host = document.createElement("div");
  host.className = "orca-df-images-backdrop orca-df-scope";
  host.innerHTML =
    '<div class="orca-df-tools-pop orca-df-tools-wide" role="dialog" aria-label="管理图片">' +
    '<div class="orca-df-tools-head"><span>图片（最多 9 张）</span>' +
    '<button type="button" class="orca-df-tools-close" data-df-img="close" aria-label="关闭">×</button></div>' +
    '<div class="orca-df-tools-body">' +
    '<div class="orca-df-img-list"></div>' +
    '<div class="orca-df-img-progress"><div class="orca-df-img-progress-bar" style="width:0%"></div></div>' +
    '<div class="orca-df-tools-muted orca-df-img-status">可添加、排序；失败可重试后保存</div>' +
    '<div class="orca-df-tools-actions">' +
    '<button type="button" class="orca-df-tools-btn" data-df-img="add">添加图片</button>' +
    '<button type="button" class="orca-df-tools-btn" data-df-img="retry">重试失败</button>' +
    '<button type="button" class="orca-df-tools-btn primary" data-df-img="save">保存到日记</button>' +
    "</div>" +
    '<input type="file" accept="image/*" multiple hidden data-df-img-file />' +
    "</div></div>";
  dfMountDialog(host);
  var listEl = host.querySelector(".orca-df-img-list");
  var bar = host.querySelector(".orca-df-img-progress-bar");
  var status = host.querySelector(".orca-df-img-status");
  var fileInput = host.querySelector("[data-df-img-file]");
  var rows = (item.images || []).filter(Boolean).slice(0, 9).map(function (src, i) {
    return {
      src: src,
      status: "ready",
      error: "",
      caption: (item.imagesMeta && item.imagesMeta[i]) || ""
    };
  });
  var busy = false;
  var dragIdx = -1;
  listEl.addEventListener("dragstart", function (e) {
    var row = e.target.closest && e.target.closest("[data-idx]");
    if (!row) return;
    dragIdx = Number(row.getAttribute("data-idx"));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    row.classList.add("is-dragging");
  });
  listEl.addEventListener("dragend", function (e) {
    var row = e.target.closest && e.target.closest("[data-idx]");
    if (row) row.classList.remove("is-dragging");
    dragIdx = -1;
  });
  listEl.addEventListener("dragover", function (e) {
    if (dragIdx < 0) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  });
  listEl.addEventListener("drop", function (e) {
    var row = e.target.closest && e.target.closest("[data-idx]");
    if (!row || dragIdx < 0) return;
    e.preventDefault();
    var to = Number(row.getAttribute("data-idx"));
    if (!isFinite(to) || to === dragIdx) return;
    var moved = rows.splice(dragIdx, 1)[0];
    rows.splice(to, 0, moved);
    dragIdx = -1;
    render();
  });
  listEl.addEventListener("input", function (e) {
    var inp = e.target && e.target.closest && e.target.closest("[data-cap]");
    if (!inp) return;
    var i = Number(inp.getAttribute("data-cap"));
    if (rows[i]) rows[i].caption = inp.value;
  });

  function setProgress(done, total) {
    var pct = total ? Math.round((done / total) * 100) : 0;
    bar.style.width = pct + "%";
  }

  function render() {
    if (!rows.length) {
      listEl.innerHTML = '<div class="orca-df-tools-muted">暂无图片</div>';
      return;
    }
    listEl.innerHTML = rows.map(function (r, i) {
      var thumb = r.preview || r.src || "";
      var st = r.status === "error" ? (dfT("失败") + (r.error ? "：" + r.error : "")) :
        r.status === "uploading" ? dfT("上传中…") :
          r.status === "pending" ? dfT("等待上传") : dfT("就绪");
      var upLabel = dfLocaleIsEn() ? "Up" : "上";
      var downLabel = dfLocaleIsEn() ? "Down" : "下";
      var rmLabel = dfLocaleIsEn() ? "Del" : "删";
      return (
        '<div class="orca-df-img-row" draggable="true" data-idx="' + i + '">' +
        '<img class="orca-df-img-thumb" src="' + orcaToolsEsc(thumb) + '" alt="" />' +
        '<div class="orca-df-img-meta">' +
          '<input type="text" class="orca-df-img-cap" data-cap="' + i + '" maxlength="80" placeholder="' + orcaToolsEsc(dfT("图片说明")) + '" value="' + orcaToolsEsc(r.caption || "") + '" />' +
          '<div class="orca-df-tools-muted">' + orcaToolsEsc(st) + "</div>" +
        "</div>" +
        '<div class="orca-df-img-acts">' +
        '<button type="button" class="orca-df-tools-mini" data-df-img="up" data-idx="' + i + '" ' + (i === 0 ? "disabled" : "") + '>' + upLabel + "</button>" +
        '<button type="button" class="orca-df-tools-mini" data-df-img="down" data-idx="' + i + '" ' + (i >= rows.length - 1 ? "disabled" : "") + '>' + downLabel + "</button>" +
        '<button type="button" class="orca-df-tools-mini" data-df-img="rm" data-idx="' + i + '">' + rmLabel + "</button>" +
        "</div></div>"
      );
    }).join("");
  }

  async function uploadOne(row) {
    if (!row || row.status === "ready") return row;
    row.status = "uploading";
    render();
    try {
      var asset = null;
      if (typeof OrcaBlocks.srcToOrcaAsset === "function") {
        asset = await OrcaBlocks.srcToOrcaAsset(row.src);
      }
      if (!asset) throw new Error("上传失败");
      row.src = asset;
      row.preview = asset;
      row.status = "ready";
      row.error = "";
    } catch (e) {
      row.status = "error";
      row.error = String(e && e.message || e || (dfLocaleIsEn() ? "Failed" : "失败"));
    }
    render();
    return row;
  }

  async function uploadPending() {
    var pending = rows.filter(function (r) { return r.status === "pending" || r.status === "error"; });
    var done = 0;
    setProgress(0, pending.length || 1);
    for (var i = 0; i < pending.length; i++) {
      await uploadOne(pending[i]);
      done++;
      setProgress(done, pending.length);
    }
    status.textContent = pending.length
      ? (dfT("上传完成：成功 ") + rows.filter(function (r) { return r.status === "ready"; }).length +
        dfT(" / 失败 ") + rows.filter(function (r) { return r.status === "error"; }).length)
      : dfT("无需上传");
  }

  host.addEventListener("mousedown", function (e) {
    if (e.target === host) orcaCloseImagesDialog();
  });
  host.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-df-img]");
    if (!btn || !host.contains(btn)) return;
    var act = btn.getAttribute("data-df-img");
    if (act === "close") { orcaCloseImagesDialog(); return; }
    if (act === "add") { fileInput.click(); return; }
    var idx = Number(btn.getAttribute("data-idx"));
    if (act === "rm" && isFinite(idx)) {
      if (rows[idx] && rows[idx].preview && String(rows[idx].preview).indexOf("blob:") === 0) {
        try { URL.revokeObjectURL(rows[idx].preview); } catch (e2) {}
      }
      rows.splice(idx, 1);
      render();
      return;
    }
    if (act === "up" && isFinite(idx) && idx > 0) {
      var t = rows[idx - 1]; rows[idx - 1] = rows[idx]; rows[idx] = t;
      render();
      return;
    }
    if (act === "down" && isFinite(idx) && idx < rows.length - 1) {
      var t2 = rows[idx + 1]; rows[idx + 1] = rows[idx]; rows[idx] = t2;
      render();
      return;
    }
    if (busy) return;
    if (act === "retry") {
      busy = true;
      rows.forEach(function (r) { if (r.status === "error") r.status = "pending"; });
      uploadPending().then(function () { busy = false; });
      return;
    }
    if (act === "save") {
      busy = true;
      status.textContent = dfT("保存中…");
      uploadPending().then(function () {
        var failed = rows.filter(function (r) { return r.status === "error"; });
        if (failed.length) {
          status.textContent = dfT("仍有 ") + failed.length + dfT(" 张失败，可重试后再保存");
          busy = false;
          return null;
        }
        var ready = rows.filter(function (r) { return r.status === "ready"; }).slice(0, 9);
        var imgs = ready.map(function (r) { return r.src; });
        var metas = ready.map(function (r) { return r.caption || ""; });
        return OrcaBlocks.updateEntry(bid, { images: imgs, imagesMeta: metas });
      }).then(function (res) {
        if (res == null) return;
        var ready2 = rows.filter(function (r) { return r.status === "ready"; }).slice(0, 9);
        item.images = ready2.map(function (r) { return r.src; });
        item.imagesMeta = ready2.map(function (r) { return r.caption || ""; });
        orcaShowMessage("图片已保存");
        orcaCloseImagesDialog();
        return orcaRefreshFeed({ keepLimit: true, skipHeal: true, preferLive: true }).then(function () {
          if (ctx && ctx.reApp) ctx.reApp();
        });
      }).catch(function (err) {
        status.textContent = dfT("保存失败：") + String(err && err.message || err);
        orcaShowMessage("保存图片失败");
      }).then(function () { busy = false; });
    }
  });
  fileInput.addEventListener("change", function () {
    var files = Array.prototype.slice.call(fileInput.files || []);
    fileInput.value = "";
    var room = 9 - rows.length;
    if (room <= 0) {
      orcaShowMessage("最多 9 张图");
      return;
    }
    files.slice(0, room).forEach(function (f) {
      var url = URL.createObjectURL(f);
      orcaImagesBlobUrls.push(url);
      rows.push({ src: url, preview: url, status: "pending", error: "" });
    });
    render();
    if (busy) return;
    busy = true;
    uploadPending().then(function () { busy = false; });
  });
  orcaToolsBindEsc(orcaCloseImagesDialog);
  render();
}

function orcaEnhanceToolsUi(el, ctx) {
  if (!el) return;
  var stack = el.querySelector(".mom-fab-stack");
  if (stack) {
    stack.querySelectorAll("[data-df-act=open-trash], [data-df-act=open-archive], [data-df-act=open-search]").forEach(function (n) {
      n.remove();
    });
  }
  if (stack && !stack.querySelector("[data-df-act=open-tools]")) {
    var toolsBtn = document.createElement("button");
    toolsBtn.type = "button";
    toolsBtn.className = "mom-outline-fab orca-df-tools-fab";
    toolsBtn.setAttribute("data-df-act", "open-tools");
    toolsBtn.title = dfT("工具（归档/回收站/搜索/统计/导出…）");
    toolsBtn.setAttribute("aria-label", dfT("工具"));
    toolsBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>' +
      '<span class="orca-df-tools-fab-count" hidden>0</span>';
    var syncEl = stack.querySelector("[data-df-act=refresh-feed]");
    if (syncEl && syncEl.nextSibling) stack.insertBefore(toolsBtn, syncEl.nextSibling);
    else if (syncEl) stack.appendChild(toolsBtn);
    else stack.appendChild(toolsBtn);
  }
  if (stack) {
    var toolsEl = stack.querySelector("[data-df-act=open-tools]");
    if (toolsEl) {
      var kwOn = !!(ctx.filters && ctx.filters.kw);
      toolsEl.classList.toggle("is-on", kwOn);
      if (!toolsEl.querySelector(".orca-df-tools-fab-count")) {
        var badge = document.createElement("span");
        badge.className = "orca-df-tools-fab-count";
        badge.hidden = true;
        badge.textContent = "0";
        toolsEl.appendChild(badge);
      }
    }
  }

  // 快捷筛选条
  var quick = el.querySelector(".orca-df-quickbar");
  if (!quick) {
    quick = document.createElement("div");
    quick.className = "orca-df-quickbar";
    var tagbar = el.querySelector(".orca-df-tagbar");
    var list = el.querySelector(".mom-list") || el.querySelector("[data-list]");
    if (tagbar && tagbar.parentNode) tagbar.parentNode.insertBefore(quick, tagbar.nextSibling);
    else if (list && list.parentNode) list.parentNode.insertBefore(quick, list);
    else el.appendChild(quick);
  }
  var f = ctx.filters || {};
  var hasQ = orcaToolsHasQuickFilters(f);
  quick.innerHTML =
    '<span class="orca-df-tagbar-label">' + dfT("筛选") + "</span>" +
    '<button type="button" class="orca-df-tagchip' + (f.hasImage ? " is-on" : "") + '" data-df-act="quick-image">' + dfT("有图") + "</button>" +
    '<button type="button" class="orca-df-tagchip' + (f.hasLocation ? " is-on" : "") + '" data-df-act="quick-location">' + dfT("有地点") + "</button>" +
    '<button type="button" class="orca-df-tagchip' + (f.pinnedOnly ? " is-on" : "") + '" data-df-act="quick-pinned">' + dfT("仅置顶") + "</button>" +
    ((f.dateFrom || f.dateTo)
      ? '<button type="button" class="orca-df-tagchip is-on" data-df-act="clear-date" title="' + orcaToolsEsc(dfT("清除日期")) + '">' +
        dfT("日期：") + orcaToolsEsc((f.dateFrom || "…") + " ~ " + (f.dateTo || "…")) + "</button>"
      : "") +
    (hasQ || (f.kw) ? '<button type="button" class="orca-df-tagchip" data-df-act="clear-quick">' + dfT("清除筛选") + "</button>" : "") +
    (f.kw ? '<span class="orca-df-quick-kw">' + dfT("搜索：") + orcaToolsEsc(f.kw) + "</span>" : "");

  orcaToolsGetLayout().then(function (p) {
    if (!el.isConnected) return;
    el.classList.remove("orca-df-layout-cozy", "orca-df-layout-compact", "orca-df-layout-tall");
    el.classList.add("orca-df-layout-" + p);
  }).catch(function () {});
}

function orcaHandleToolsAct(ctx, act, btn) {
  if (act === "open-tools") {
    orcaOpenToolsHub(ctx);
    return true;
  }
  if (act === "open-search") {
    orcaOpenSearchDialog(ctx);
    return true;
  }
  if (act === "open-stats") {
    orcaOpenStatsDialog(ctx);
    return true;
  }
  if (act === "quick-image") {
    if (!ctx.filters) ctx.filters = { kw: "", tags: [] };
    ctx.filters.hasImage = !ctx.filters.hasImage;
    if (typeof orcaPersistFilters === "function") orcaPersistFilters();
    orcaApplyFeedWindow(orcaMomentsData && orcaMomentsData.config);
    DF_ASSETS.hydrate(orcaMomentsData).then(function () { if (ctx.reApp) ctx.reApp(); });
    return true;
  }
  if (act === "quick-location") {
    if (!ctx.filters) ctx.filters = { kw: "", tags: [] };
    ctx.filters.hasLocation = !ctx.filters.hasLocation;
    if (typeof orcaPersistFilters === "function") orcaPersistFilters();
    orcaApplyFeedWindow(orcaMomentsData && orcaMomentsData.config);
    DF_ASSETS.hydrate(orcaMomentsData).then(function () { if (ctx.reApp) ctx.reApp(); });
    return true;
  }
  if (act === "quick-pinned") {
    if (!ctx.filters) ctx.filters = { kw: "", tags: [] };
    ctx.filters.pinnedOnly = !ctx.filters.pinnedOnly;
    if (typeof orcaPersistFilters === "function") orcaPersistFilters();
    orcaApplyFeedWindow(orcaMomentsData && orcaMomentsData.config);
    DF_ASSETS.hydrate(orcaMomentsData).then(function () { if (ctx.reApp) ctx.reApp(); });
    return true;
  }
  if (act === "clear-date") {
    if (!ctx.filters) ctx.filters = { kw: "", tags: [] };
    ctx.filters.dateFrom = "";
    ctx.filters.dateTo = "";
    if (typeof orcaPersistFilters === "function") orcaPersistFilters();
    orcaApplyFeedWindow(orcaMomentsData && orcaMomentsData.config);
    DF_ASSETS.hydrate(orcaMomentsData).then(function () { if (ctx.reApp) ctx.reApp(); });
    return true;
  }
  if (act === "clear-quick") {
    if (!ctx.filters) ctx.filters = { kw: "", tags: [] };
    orcaToolsClearQuickFilters(ctx.filters);
    ctx.filters.kw = "";
    if (typeof orcaPersistFilters === "function") orcaPersistFilters();
    orcaRefreshFeed().then(function () { if (ctx.reApp) ctx.reApp(); });
    return true;
  }
  if (act === "manage-images") {
    var id = btn.getAttribute("data-id") || btn.getAttribute("data-mid");
    var it = ((ctx.data() && ctx.data().items) || []).find(function (x) {
      return String(x.id) === String(id);
    });
    if (!it && orcaFeedAllItems) {
      it = orcaFeedAllItems.find(function (x) { return String(x.id) === String(id); });
    }
    orcaOpenImagesDialog(ctx, it);
    return true;
  }
  return false;
}


// ===== Orca Note entry =====
var ORCA_CSS = "/* src/style.css */\n.mom-root {\n  position: relative;\n  height: 100%;\n  min-height: 0;\n  overflow: hidden;\n  display: flex;\n  flex-direction: column;\n  background: var(--b3-theme-background, #fff);\n  font-family: inherit;\n  color: var(--b3-theme-on-background, #222);\n}\n.mom-scroll {\n  flex: 1 1 auto;\n  min-height: 0;\n  overflow-y: auto;\n  overflow-x: hidden;\n  display: flex;\n  flex-direction: column;\n}\n.mom-cover {\n  position: relative;\n  height: clamp(170px, 26vh, 300px);\n  flex-shrink: 0;\n  overflow: hidden;\n}\n.mom-cover-bg {\n  height: 100%;\n  position: relative;\n  overflow: hidden;\n}\n.mom-cover-img {\n  position: absolute;\n  inset: 0;\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n  display: block;\n}\n.mom-cover-default {\n  position: absolute;\n  inset: 0;\n  background:\n    linear-gradient(\n      150deg,\n      var(--b3-theme-primary, #4e6ef2) 0%,\n      color-mix(in srgb, var(--b3-theme-primary, #4e6ef2) 45%, #0c0c20) 100%);\n}\n.mom-cover-shade {\n  position: absolute;\n  inset: 0;\n  z-index: 1;\n  background:\n    linear-gradient(\n      180deg,\n      rgba(0, 0, 0, .06),\n      rgba(0, 0, 0, .4));\n}\n.mom-cover-stats {\n  position: absolute;\n  bottom: 24px;\n  right: 16px;\n  z-index: 10;\n  font-size: 13px;\n  color: #fff;\n  padding: 5px 12px;\n  border-radius: 999px;\n  background: rgba(0, 0, 0, .28);\n  backdrop-filter: blur(6px);\n  -webkit-backdrop-filter: blur(6px);\n  text-shadow: 0 1px 2px rgba(0, 0, 0, .3);\n  white-space: nowrap;\n}\n.mom-cover-settings {\n  position: absolute;\n  top: 14px;\n  right: 14px;\n  z-index: 12;\n  width: 30px;\n  height: 30px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  border: none;\n  border-radius: 8px;\n  background: rgba(255, 255, 255, .28);\n  color: #fff;\n  cursor: pointer;\n  transition: background .18s ease, transform .15s ease;\n}\n.mom-cover-settings:hover {\n  background: rgba(255, 255, 255, .5);\n  transform: scale(1.05);\n}\n.mom-avatar-ph {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background:\n    linear-gradient(\n      135deg,\n      var(--b3-theme-primary, #4e6ef2),\n      color-mix(in srgb, var(--b3-theme-primary, #4e6ef2) 52%, #0c0c20));\n  color: #fff;\n  font-weight: 600;\n}\n.mom-filter-row {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n.mom-actions {\n  display: flex;\n  gap: 8px;\n}\n.mom-actions .mom-btn-primary {\n  margin-left: auto;\n}\n.mom-chip {\n  border: 1px solid var(--b3-border-color, #ddd);\n  background: transparent;\n  color: var(--b3-theme-on-background, #333);\n  border-radius: 999px;\n  padding: 3px 10px;\n  font-size: 12px;\n  cursor: pointer;\n}\n.mom-chip.active {\n  border-color: var(--b3-theme-primary, #4e6ef2);\n  color: #fff;\n  background: var(--b3-theme-primary, #4e6ef2);\n}\n.mom-btn {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  border: 1px solid var(--b3-border-color, #ddd);\n  background: transparent;\n  color: var(--b3-theme-on-background, #333);\n  border-radius: 6px;\n  padding: 5px 12px;\n  font-size: 13px;\n  cursor: pointer;\n}\n.mom-btn:hover {\n  background: var(--b3-theme-background-light, #f2f2f2);\n}\n.mom-btn-primary {\n  background: var(--b3-theme-primary, #4e6ef2);\n  border-color: var(--b3-theme-primary, #4e6ef2);\n  color: #fff;\n}\n.mom-btn-primary:hover {\n  opacity: .9;\n}\n.mom-btn-small {\n  padding: 3px 9px;\n  font-size: 12px;\n}\n.mom-btn-danger {\n  border-color: #e05050;\n  color: #e05050;\n}\n.mom-btn-danger:hover {\n  background: #fdecec;\n}\n.mom-signature {\n  background-color: var(--moments-signature-bg, #f7f7f7);\n  padding: 14px 16px 10px;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  flex-wrap: wrap;\n  flex-shrink: 0;\n}\n.mom-signature-tools {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  flex-wrap: wrap;\n}\n.mom-cover-tool {\n  display: inline-flex !important;\n  align-items: center;\n  justify-content: center;\n  gap: 4px;\n  height: 30px;\n  padding: 0 12px;\n  border: none;\n  border-radius: 8px;\n  background: rgba(255, 255, 255, .78);\n  color: #333;\n  font-size: 12px;\n  cursor: pointer;\n  box-shadow: 0 1px 4px rgba(0, 0, 0, .12);\n  transition:\n    background .18s ease,\n    transform .15s ease,\n    box-shadow .18s ease;\n  box-sizing: border-box;\n}\n.mom-cover-tool:hover {\n  background: #fff;\n  transform: translateY(-1px);\n}\n.mom-cover-tool-danger:hover {\n  background: #ff6b6b;\n  color: #fff;\n}\n.mom-signature-text {\n  font-size: 13px;\n  color: var(--moments-signature-text, #888);\n  line-height: 1.5;\n  margin-left: auto;\n  max-width: 40%;\n  word-break: break-word;\n}\n.mom-pin-strip {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  padding: 10px 16px;\n  margin: 8px auto 0;\n  width: 73%;\n  box-sizing: border-box;\n  background-color: color-mix(in srgb, var(--b3-theme-surface, #fff) 30%, transparent);\n  border-radius: 8px;\n  border: 1px solid color-mix(in srgb, var(--moments-card-border, #ddd) 75%, transparent);\n  cursor: pointer;\n  flex-shrink: 0;\n}\n.mom-pin-strip-label {\n  font-size: 12px;\n  font-weight: 600;\n  color: var(--b3-theme-on-background, #333);\n  flex-shrink: 0;\n}\n.mom-pin-strip-thumbs {\n  display: flex;\n  gap: 12px;\n  overflow: hidden;\n  flex: 1;\n}\n.mom-pin-group {\n  display: grid;\n  gap: 2px;\n  padding: 0;\n  border: none;\n  background: none;\n  cursor: pointer;\n  flex-shrink: 0;\n}\n.mom-pin-group:hover {\n  opacity: .9;\n}\n.mom-pin-thumb {\n  position: relative;\n  overflow: hidden;\n  border-radius: 4px;\n}\n.mom-pin-thumb img {\n  width: 44px;\n  height: 44px;\n  object-fit: cover;\n  display: block;\n}\n.mom-pin-thumb-video,\n.mom-cal-thumb-video {\n  background: #000;\n}\n.mom-pin-thumb-single img {\n  width: 88px;\n  height: 88px;\n}\n.mom-pin-thumb-text {\n  width: 88px;\n  height: 88px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: color-mix(in srgb, var(--b3-theme-surface, #fff) 40%, transparent);\n}\n.mom-pin-text {\n  font-size: 12px;\n  color: var(--b3-theme-on-background, #333);\n  padding: 4px;\n  word-break: break-word;\n  line-height: 1.4;\n}\n.mom-pin-text-center {\n  font-size: 13px;\n  font-weight: 600;\n}\n.mom-pin-text-flow {\n  display: -webkit-box;\n  -webkit-line-clamp: 3;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n}\n.mom-pin-thumb-more {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: rgba(0, 0, 0, .45);\n  color: #fff;\n  font-size: 16px;\n  font-weight: 600;\n}\n.mom-list {\n  flex: 0 0 auto;\n  overflow: visible;\n  padding: 14px 0 90px;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 12px;\n}\n.mom-filter-bar {\n  width: 73%;\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.mom-empty {\n  text-align: center;\n  color: #999;\n  margin: 72px auto 0;\n  font-size: 14px;\n  max-width: 240px;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 6px;\n}\n.mom-empty-ico {\n  font-size: 40px;\n  line-height: 1;\n  margin-bottom: 6px;\n  opacity: .9;\n}\n.mom-empty-title {\n  font-size: 16px;\n  font-weight: 600;\n  color: var(--b3-theme-on-background, #333);\n  margin: 0;\n}\n.mom-empty-sub {\n  font-size: 13px;\n  color: #999;\n  margin: 0;\n}\n.mom-empty-btn {\n  margin-top: 14px;\n}\n.mom-empty-result {\n  margin-top: 72px;\n}\n.mom-item {\n  content-visibility: auto;\n  contain-intrinsic-size: auto 250px;\n  display: flex;\n  position: relative;\n  border-radius: 8px;\n  padding: 16px;\n  background-color: color-mix(in srgb, var(--b3-theme-surface, #fff) 30%, transparent);\n  border: 1px solid color-mix(in srgb, var(--moments-card-border, #ddd) 75%, transparent);\n  width: 73%;\n  box-sizing: border-box;\n}\n.mom-item:hover {\n  border-color: color-mix(in srgb, var(--b3-theme-primary, #4e6ef2) 55%, transparent);\n}\n.mom-pin-badge {\n  position: absolute;\n  top: 8px;\n  left: 8px;\n  z-index: 3;\n  display: flex;\n  align-items: center;\n  color: var(--b3-theme-primary, #4e6ef2);\n}\n.mom-item-avatar {\n  width: 48px;\n  height: 48px;\n  border-radius: 6px;\n  object-fit: cover;\n  flex-shrink: 0;\n  margin-right: 12px;\n  background-color: var(--moments-border, #ddd);\n}\n.mom-item-avatar.mom-avatar-ph {\n  font-size: 20px;\n}\n.mom-item-content {\n  flex: 1;\n  min-width: 0;\n}\n.mom-item-name {\n  font-size: 16px;\n  color: var(--b3-theme-on-background, #333);\n  font-weight: 600;\n  line-height: 1.4;\n  margin-bottom: 4px;\n}\n.mom-item-text {\n  font-size: 14px;\n  color: var(--b3-theme-on-background, #333);\n  line-height: 1.8;\n  margin-bottom: 6px;\n  word-break: break-word;\n  white-space: pre-wrap;\n  user-select: text;\n}\n.mom-no-text {\n  color: #bbb;\n  font-size: 13px;\n}\n.mom-long-toggle {\n  font-size: 12px;\n  color: var(--b3-theme-primary, #4e6ef2);\n  background: none;\n  border: none;\n  cursor: pointer;\n  padding: 0;\n  margin-top: 2px;\n}\n.mom-card-imgs {\n  display: grid;\n  gap: 4px;\n  margin-top: 10px;\n}\n.mom-grid-1 {\n  grid-template-columns: 1fr;\n  max-width: 320px;\n}\n.mom-grid-2 {\n  grid-template-columns: 1fr 1fr;\n}\n.mom-grid-3 {\n  grid-template-columns: 1fr 1fr 1fr;\n}\n.mom-img-cell {\n  position: relative;\n  overflow: hidden;\n  border-radius: 6px;\n  aspect-ratio: 1;\n  background: #f0f0f0;\n}\n.mom-img-cell img {\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n  cursor: zoom-in;\n  display: block;\n}\n.mom-card-link {\n  margin-top: 10px;\n}\n.mom-card-link a {\n  color: var(--b3-theme-primary, #4e6ef2);\n  text-decoration: none;\n  font-size: 13px;\n}\n.mom-card-link a:hover {\n  text-decoration: underline;\n}\n.mom-bottom-space {\n  height: 90px;\n  flex-shrink: 0;\n}\n.mom-fab-stack {\n  position: absolute;\n  z-index: 40;\n  right: 16px;\n  bottom: 48px;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 8px;\n  margin: 0;\n  padding-right: 0;\n  flex: none;\n  pointer-events: none;\n}\n.mom-outline-fab {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 44px;\n  height: 44px;\n  padding: 0;\n  border: none;\n  border-radius: 50%;\n  cursor: pointer;\n  color: var(--b3-theme-on-background, #333);\n  background: var(--b3-theme-surface, #fff);\n  border: 1px solid var(--b3-border-color, #ddd);\n  box-shadow: 0 4px 14px rgba(0, 0, 0, .18);\n  transition: transform .15s ease, box-shadow .15s ease;\n  flex: none;\n  pointer-events: auto;\n}\n.mom-outline-fab:hover {\n  transform: translateY(-1px);\n  box-shadow: 0 6px 18px rgba(0, 0, 0, .24);\n}\n.mom-fab-stack.is-mobile {\n  position: absolute;\n  right: 16px;\n  bottom: 80px;\n  left: auto;\n  margin: 0;\n}\n.mom-outline-fab.is-mobile {\n  transform: none;\n}\n.mom-lightbox {\n  position: fixed;\n  inset: 0;\n  background: rgba(0, 0, 0, .85);\n  z-index: 1002;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  cursor: zoom-out;\n}\n.mom-lightbox-img {\n  max-width: 92%;\n  max-height: 88vh;\n  border-radius: 6px;\n  object-fit: contain;\n}\n.mom-lightbox-close {\n  position: absolute;\n  top: 16px;\n  right: 16px;\n  z-index: 2;\n  width: 36px;\n  height: 36px;\n  border: none;\n  border-radius: 50%;\n  background: rgba(255, 255, 255, .15);\n  color: #fff;\n  font-size: 22px;\n  line-height: 1;\n  cursor: pointer;\n}\n.mom-lightbox-close:hover {\n  background: rgba(255, 255, 255, .28);\n}\n.mom-lightbox-nav {\n  position: absolute;\n  top: 50%;\n  transform: translateY(-50%);\n  z-index: 2;\n  width: 44px;\n  height: 44px;\n  border: none;\n  border-radius: 50%;\n  background: rgba(255, 255, 255, .15);\n  color: #fff;\n  font-size: 28px;\n  line-height: 1;\n  cursor: pointer;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n.mom-lightbox-nav:hover:not(:disabled) {\n  background: rgba(255, 255, 255, .28);\n}\n.mom-lightbox-nav:disabled {\n  opacity: .25;\n  cursor: default;\n}\n.mom-lightbox-prev {\n  left: 12px;\n}\n.mom-lightbox-next {\n  right: 12px;\n}\n.mom-lightbox-dots {\n  position: absolute;\n  bottom: 20px;\n  left: 50%;\n  transform: translateX(-50%);\n  display: flex;\n  gap: 8px;\n  z-index: 2;\n}\n.mom-lightbox-dot {\n  width: 8px;\n  height: 8px;\n  padding: 0;\n  border: none;\n  border-radius: 50%;\n  background: rgba(255, 255, 255, .35);\n  cursor: pointer;\n}\n.mom-lightbox-dot.active {\n  background: #fff;\n  transform: scale(1.15);\n}\n.mom-lightbox-counter {\n  position: absolute;\n  top: 20px;\n  left: 50%;\n  transform: translateX(-50%);\n  color: rgba(255, 255, 255, .85);\n  font-size: 13px;\n  z-index: 2;\n  pointer-events: none;\n}\n.mom-confirm-msg {\n  margin: 0;\n  font-size: 14px;\n  line-height: 1.6;\n  color: var(--b3-theme-on-background);\n  white-space: pre-wrap;\n}\n.north-luna-moments-item-header {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  margin-bottom: 10px;\n}\n.north-luna-moments-item-header .mom-avatar {\n  width: 40px;\n  height: 40px;\n  border-radius: 8px;\n  object-fit: cover;\n  flex-shrink: 0;\n}\n.north-luna-moments-item-header .mom-avatar-ph {\n  width: 40px;\n  height: 40px;\n  border-radius: 8px;\n  font-size: 16px;\n}\n.north-luna-moments-item-name {\n  font-size: 15px;\n  font-weight: 600;\n  color: var(--b3-theme-on-background);\n  line-height: 1.3;\n}\n.mom-lightbox[hidden] {\n  display: none;\n}\n.mom-lightbox img {\n  max-width: 92%;\n  max-height: 92%;\n  border-radius: 6px;\n}\n.mom-overlay {\n  position: fixed;\n  inset: 0;\n  background: rgba(0, 0, 0, .4);\n  z-index: 2147483000;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  box-sizing: border-box;\n  padding: max(16px, env(safe-area-inset-top, 0px)) 16px max(16px, env(safe-area-inset-bottom, 0px));\n}\n.mom-modal {\n  background: var(--b3-theme-background, #fff);\n  border-radius: 12px;\n  width: min(560px, 92vw);\n  max-height: 86vh;\n  display: flex;\n  flex-direction: column;\n  box-shadow: 0 10px 40px rgba(0, 0, 0, .3);\n}\n.mom-modal-sm {\n  width: min(340px, 90vw);\n}\n.mom-overlay.mom-settings .mom-modal {\n  width: min(320px, 92vw);\n  font-size: 16px;\n}\n.mom-overlay.mom-settings .mom-field {\n  font-size: 15px;\n}\n.mom-overlay.mom-settings .mom-modal-head {\n  font-size: 17px;\n}\n.mom-overlay.mom-settings .mom-modal-head .mom-modal-x {\n  font-size: 18px;\n}\n.mom-overlay.mom-settings .mom-inp {\n  width: 240px;\n  font-size: 15px;\n}\n.mom-overlay.mom-settings .mom-hint {\n  font-size: 13px;\n}\n.mom-overlay.mom-settings label.mom-btn:has(> input[type=\"file\"]) {\n  width: 240px;\n}\n/* ===== 日历弹窗（复刻 siyuan-moments）===== */\n.mom-overlay.mom-calendar {\n  background: rgba(0, 0, 0, .5);\n}\n.mom-calendar-modal {\n  display: contents;\n}\n.mom-calendar-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 2147483000;\n  touch-action: none;\n}\n.mom-calendar-content {\n  position: relative;\n  background: var(--b3-theme-background);\n  border-radius: 12px;\n  width: auto;\n  max-width: 1200px;\n  min-width: 0;\n  max-height: 60vh;\n  overflow: hidden;\n  z-index: 2147483001;\n  box-shadow: 0 4px 24px rgba(0, 0, 0, .3);\n  display: flex;\n  flex-direction: column;\n  transition: box-shadow .2s ease, transform .2s ease;\n  touch-action: pan-y;\n  overscroll-behavior: contain;\n}\n.mom-calendar-content.dragging {\n  transition: none;\n  cursor: grabbing;\n}\n.mom-calendar-header {\n  display: flex;\n  flex-direction: row;\n  flex-wrap: nowrap;\n  align-items: center;\n  justify-content: space-between;\n  padding: 12px 16px;\n  border-bottom: 1px solid color-mix(in srgb, var(--b3-border-color) 35%, transparent);\n  flex-shrink: 0;\n  cursor: move;\n  user-select: none;\n}\n.mom-calendar-title {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  flex: 1;\n  min-width: 0;\n  white-space: nowrap;\n  overflow: hidden;\n}\n.mom-calendar-title > span:first-child {\n  font-size: 15px;\n  font-weight: 600;\n}\n.mom-calendar-year {\n  font-size: 13px;\n  color: var(--b3-theme-primary);\n  background: transparent;\n  border: none;\n  outline: none;\n  cursor: pointer;\n  padding: 2px 4px;\n  font-family: inherit;\n  -webkit-appearance: none;\n  -moz-appearance: none;\n  appearance: none;\n  flex-shrink: 0;\n}\n.mom-calendar-modes {\n  display: inline-flex;\n  gap: 2px;\n  flex-shrink: 0;\n}\n.mom-calendar-mode {\n  border: 1px solid var(--b3-border-color);\n  background: transparent;\n  color: var(--b3-theme-on-surface);\n  font-size: 12px;\n  padding: 2px 9px;\n  border-radius: 999px;\n  cursor: pointer;\n  line-height: 1.4;\n}\n.mom-calendar-mode.on {\n  background: var(--b3-theme-primary);\n  border-color: var(--b3-theme-primary);\n  color: #fff;\n}\n.mom-calendar-count {\n  font-size: 12px;\n  color: var(--b3-theme-primary);\n  margin-left: 2px;\n  flex-shrink: 0;\n}\n.mom-calendar-close {\n  width: 28px;\n  height: 28px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n  font-size: 20px;\n  color: var(--b3-theme-on-surface);\n  border-radius: 4px;\n  flex-shrink: 0;\n}\n.mom-calendar-close:hover {\n  background-color: var(--b3-list-hover);\n}\n.mom-calendar-body {\n  padding: 16px;\n  overflow: auto;\n}\n.mom-calendar-grid {\n  width: 100%;\n  display: block;\n}\n.mom-calendar-columns {\n  display: flex;\n  gap: 4px;\n}\n.mom-calendar-column {\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n.mom-calendar-cell {\n  width: 100%;\n  min-width: 10px;\n  aspect-ratio: 1;\n  border-radius: 3px;\n  background-color: color-mix(in srgb, var(--b3-theme-surface-lighter) 40%, transparent);\n  transition: all .15s;\n  cursor: pointer;\n}\n.mom-calendar-cell:hover {\n  transform: scale(1.2);\n  box-shadow: 0 0 0 1px var(--b3-theme-primary);\n}\n.mom-calendar-cell.level-empty {\n  background-color: color-mix(in srgb, var(--b3-theme-surface-lighter) 40%, transparent);\n  opacity: .5;\n}\n.mom-calendar-cell.level-empty:hover {\n  transform: none;\n  box-shadow: none;\n}\n.mom-calendar-cell.level-1 { background-color: var(--b3-theme-primary-lightest); }\n.mom-calendar-cell.level-2 { background-color: var(--b3-theme-primary-lighter); }\n.mom-calendar-cell.level-3 { background-color: var(--b3-theme-primary-light); }\n.mom-calendar-cell.level-4 { background-color: var(--b3-theme-primary); }\n.mom-calendar-months {\n  position: relative;\n  margin-top: 8px;\n  height: 18px;\n  min-width: max-content;\n}\n.mom-calendar-month-label {\n  position: absolute;\n  transform: translateX(-50%);\n  font-size: 11px;\n  color: var(--b3-theme-on-surface-light);\n  white-space: nowrap;\n}\n.mom-calendar-photo-twocol {\n  display: flex;\n  flex-direction: column;\n  gap: 18px;\n}\n.mom-calendar-photo-month-title {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  font-size: 14px;\n  font-weight: 600;\n  color: var(--b3-theme-on-background);\n  margin: 4px 0 8px 4px;\n}\n.mom-calendar-photo-grid {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.mom-calendar-photo-row {\n  display: grid;\n  grid-template-columns: repeat(7, minmax(32px, 44px));\n  gap: 6px;\n}\n.mom-calendar-photo-cell {\n  position: relative;\n  aspect-ratio: 1;\n  width: 100%;\n  min-width: 32px;\n  max-width: 44px;\n  background-color: color-mix(in srgb, var(--b3-theme-surface-lighter) 5%, transparent);\n  border-radius: 6px;\n  border: 1px solid color-mix(in srgb, var(--b3-border-color) 20%, transparent);\n  cursor: default;\n  overflow: hidden;\n  transition: transform .15s ease, box-shadow .15s ease;\n}\n.mom-calendar-photo-cell.has-photo {\n  cursor: pointer;\n  box-shadow: 0 1px 4px rgba(0, 0, 0, .08);\n}\n.mom-calendar-photo-cell.has-photo:hover,\n.mom-calendar-photo-cell.has-record:hover {\n  transform: scale(1.05);\n  box-shadow: 0 4px 12px rgba(0, 0, 0, .15);\n  z-index: 1;\n}\n.mom-calendar-photo-cell.empty {\n  background-color: transparent;\n  border: 0;\n}\n.mom-calendar-photo-cell.has-record {\n  cursor: pointer;\n}\n.mom-calendar-photo-dot {\n  position: absolute;\n  right: 5px;\n  bottom: 5px;\n  width: 7px;\n  height: 7px;\n  border-radius: 50%;\n  background: var(--b3-theme-primary);\n  box-shadow: 0 0 0 2px color-mix(in srgb, var(--b3-theme-background) 60%, transparent);\n  z-index: 2;\n}\n.mom-calendar-photo-num {\n  position: absolute;\n  top: 4px;\n  left: 6px;\n  font-size: 11px;\n  color: var(--b3-theme-on-surface);\n  opacity: .85;\n  background: color-mix(in srgb, var(--b3-theme-background) 65%, transparent);\n  padding: 1px 5px;\n  border-radius: 3px;\n  line-height: 1.3;\n  z-index: 1;\n}\n.mom-calendar-photo-cell.has-photo .mom-calendar-photo-num {\n  color: #fff;\n  background: rgba(0, 0, 0, .45);\n  opacity: 1;\n}\n.mom-calendar-photo-img {\n  position: absolute;\n  inset: 0;\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n  z-index: 0;\n  background: var(--b3-theme-surface);\n}\n.mom-modal-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 12px 16px;\n  border-bottom: 1px solid var(--b3-border-color, #eee);\n  font-weight: 600;\n}\n.mom-modal-x {\n  border: none;\n  background: none;\n  font-size: 16px;\n  cursor: pointer;\n  color: #888;\n}\n.mom-modal-body {\n  padding: 14px 16px;\n  overflow-y: auto;\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n}\n.mom-modal-foot {\n  display: flex;\n  justify-content: flex-end;\n  gap: 8px;\n  padding: 10px 16px;\n  border-top: 1px solid var(--b3-border-color, #eee);\n}\n.mom-editor-toolbar {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  align-items: center;\n}\n.mom-inp {\n  border: 1px solid var(--b3-border-color, #ddd);\n  border-radius: 6px;\n  padding: 6px 9px;\n  font-size: 13px;\n  background: var(--b3-theme-background, #fff);\n  color: var(--b3-theme-on-background, #333);\n}\n.mom-inp-inline {\n  width: 100px;\n}\n.mom-textarea {\n  min-height: 120px;\n  width: 100%;\n  border: 1px solid var(--b3-border-color, #ddd);\n  border-radius: 8px;\n  padding: 10px;\n  font-size: 14px;\n  font-family: inherit;\n  resize: vertical;\n  background: var(--b3-theme-background, #fff);\n  color: var(--b3-theme-on-background, #333);\n}\n.mom-img-previews {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px;\n}\n.mom-img-prev {\n  position: relative;\n  width: 64px;\n  height: 64px;\n}\n.mom-img-prev img {\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n  border-radius: 6px;\n}\n.mom-img-prev-x {\n  position: absolute;\n  top: -6px;\n  right: -6px;\n  width: 18px;\n  height: 18px;\n  border-radius: 50%;\n  border: none;\n  background: #333;\n  color: #fff;\n  font-size: 11px;\n  line-height: 1;\n  cursor: pointer;\n}\n.mom-picked {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n.mom-picked-chip {\n  cursor: pointer;\n}\n.mom-pick-panel {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n.mom-field {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  font-size: 13px;\n}\n.mom-field-col {\n  align-items: flex-start;\n}\n.mom-field .mom-inp {\n  width: 100%;\n}\n.mom-hint {\n  font-size: 11px;\n  color: #999;\n}\n.mom-divider {\n  height: 1px;\n  background: var(--b3-border-color, #eee);\n}\n.mom-btn-row {\n  display: flex;\n  gap: 8px;\n  flex-wrap: wrap;\n}\n.mom-view-switch {\n  display: flex;\n  gap: 6px;\n}\n.mom-cal {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n}\n.mom-cal-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n}\n.mom-cal-nav {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n}\n.mom-cal-year {\n  font-size: 14px;\n  font-weight: 600;\n  min-width: 64px;\n  text-align: center;\n}\n.mom-cal-modes {\n  display: flex;\n  gap: 6px;\n}\n.mom-cal-months {\n  display: flex;\n  flex-direction: column;\n  gap: 16px;\n}\n.mom-cal-month {\n  background: var(--b3-theme-background, #fff);\n  border: 1px solid var(--b3-border-color, #eee);\n  border-radius: 10px;\n  padding: 10px;\n}\n.mom-cal-month-t {\n  margin: 0 0 8px;\n  font-size: 13px;\n  font-weight: 600;\n  color: var(--b3-theme-on-background, #333);\n}\n.mom-cal-grid {\n  display: grid;\n  grid-template-columns: repeat(7, 1fr);\n  gap: 4px;\n}\n.mom-cal-dow {\n  text-align: center;\n  font-size: 11px;\n  color: #aaa;\n  padding: 2px 0;\n}\n.mom-cal-blank {\n  aspect-ratio: 1;\n}\n.mom-cal-cell {\n  position: relative;\n  aspect-ratio: 1;\n  border-radius: 6px;\n  border: 1px solid transparent;\n  background: var(--b3-theme-background-light, #f4f4f4);\n  overflow: hidden;\n  cursor: pointer;\n  padding: 0;\n}\n.mom-cal-cell.has {\n  border-color: var(--b3-border-color, #ddd);\n}\n.mom-cal-cell:hover {\n  border-color: var(--b3-theme-primary, #4e6ef2);\n}\n.mom-cal-cell.is-today {\n  box-shadow: inset 0 0 0 2px var(--b3-theme-primary, #4e6ef2);\n}\n.mom-cal-cell img {\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n  display: block;\n}\n.mom-cal-daynum {\n  position: absolute;\n  left: 3px;\n  top: 3px;\n  font-size: 10px;\n  color: #fff;\n  text-shadow: 0 1px 2px rgba(0, 0, 0, .6);\n}\n.mom-cal-heatline {\n  width: 100%;\n  height: 100%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: var(--b3-theme-primary, #4e6ef2);\n  color: #fff;\n  font-size: 11px;\n  font-weight: 600;\n}\n.mom-cal-ph-cnt {\n  width: 100%;\n  height: 100%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: var(--b3-theme-primary, #4e6ef2);\n  color: #fff;\n  font-size: 13px;\n  font-weight: 600;\n}\n.mom-flash {\n  animation: mom-flash 1.6s ease;\n}\n@keyframes mom-flash {\n  0% {\n    box-shadow: 0 0 0 3px var(--b3-theme-primary, #4e6ef2);\n  }\n  100% {\n    box-shadow: 0 0 0 0 rgba(78, 110, 242, 0);\n  }\n}\n.mom-lock {\n  position: relative;\n  min-height: 100%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  overflow: hidden;\n}\n.mom-lock-bg {\n  position: absolute;\n  inset: 0;\n  background-size: cover;\n  background-position: center;\n}\n.mom-lock-bg--glass {\n  background:\n    linear-gradient(\n      180deg,\n      #fafafa,\n      #f0f0f0);\n}\n.mom-lock-panel {\n  position: relative;\n  z-index: 1;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  width: 100%;\n  height: 100%;\n  padding: 28px 26px;\n  background: transparent;\n}\n.mom-lock-top {\n  text-align: center;\n  color: #000;\n  width: 100%;\n  padding-bottom: 18px;\n  margin-bottom: 18px;\n  border-bottom: 1px solid #f0f0f0;\n}\n.mom-lock-date {\n  font-size: 12px;\n  letter-spacing: 2px;\n  color: #999;\n  text-transform: uppercase;\n}\n.mom-lock-time {\n  font-size: 44px;\n  font-weight: 200;\n  letter-spacing: 2px;\n  margin-top: 6px;\n  font-variant-numeric: tabular-nums;\n  color: #111;\n}\n.mom-lock-bottom {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  width: 100%;\n  gap: 10px;\n}\n.mom-lock-avatar {\n  width: 60px;\n  height: 60px;\n  border-radius: 50%;\n  font-size: 26px;\n}\n.mom-lock-name {\n  color: #111;\n  font-size: 14px;\n  font-weight: 600;\n}\n.mom-lock-input {\n  width: 50%;\n  border: 1px solid #e5e5e5;\n  border-radius: 10px;\n  padding: 10px 12px;\n  background: #f7f7f7;\n  color: #000;\n  font-size: 14px;\n  outline: none;\n  transition: border-color .18s ease, background .18s ease;\n}\n.mom-lock-input:focus {\n  border-color: #bbb;\n  background: #fff;\n}\n.mom-lock-input::placeholder {\n  color: #b0b0b0;\n}\n.mom-lock .mom-btn-primary {\n  width: 100%;\n  justify-content: center;\n  padding: 10px 12px;\n  border-radius: 10px;\n}\n.mom-lock-error {\n  color: #ff6b6b;\n  font-size: 12px;\n  margin: 0;\n}\n.mom-lock-hint {\n  color: #aaa;\n  font-size: 12px;\n  margin-top: 2px;\n}\n.mom-lock.shake {\n  animation: mom-shake .4s ease;\n}\n@keyframes mom-shake {\n  0%, 100% {\n    transform: translateX(0);\n  }\n  25% {\n    transform: translateX(-6px);\n  }\n  75% {\n    transform: translateX(6px);\n  }\n}\n.mom-switch {\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n  cursor: pointer;\n  font-size: 13px;\n}\n.mom-switch input {\n  display: none;\n}\n.mom-switch i {\n  width: 40px;\n  height: 22px;\n  border-radius: 999px;\n  background: #ccc;\n  position: relative;\n  transition: background .2s;\n}\n.mom-switch i::after {\n  content: \"\";\n  position: absolute;\n  top: 2px;\n  left: 2px;\n  width: 18px;\n  height: 18px;\n  border-radius: 50%;\n  background: #fff;\n  transition: transform .2s;\n  box-shadow: 0 1px 3px rgba(0, 0, 0, .3);\n}\n.mom-switch input:checked + i {\n  background: var(--b3-theme-primary, #4e6ef2);\n}\n.mom-switch input:checked + i::after {\n  transform: translateX(18px);\n}\n.mom-switch-lab {\n  cursor: pointer;\n}\n.mom-md-toolbar {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  align-items: center;\n}\n.mom-link-card {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.mom-inline-code {\n  background: var(--b3-theme-background-light, #f2f2f2);\n  border-radius: 4px;\n  padding: 1px 5px;\n  font-size: 13px;\n  font-family: var(--b3-font-family-code, monospace);\n}\n.mom-mark {\n  background: #ffe08a;\n  color: inherit;\n  padding: 0 2px;\n  border-radius: 3px;\n}\n.mom-card-text em {\n  font-style: italic;\n}\n.mom-publish-page {\n  position: absolute;\n  top: 0;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  background-color: var(--b3-theme-background, #fff);\n  z-index: 30;\n  overflow: hidden;\n  display: flex;\n  flex-direction: column;\n}\n.mom-publish-page[hidden] {\n  display: none;\n}\n.mom-publish {\n  display: flex;\n  flex-direction: column;\n  height: 100%;\n  min-height: 0;\n}\n.mom-publish-nav {\n  position: relative;\n  flex: 0 0 auto;\n  height: 44px;\n  background-color: var(--b3-theme-background, #fff);\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 0 16px;\n  border-bottom: 0.5px solid var(--moments-nav-border, #eee);\n}\n.mom-publish-back {\n  width: 24px;\n  height: 24px;\n  border: none;\n  background: transparent;\n  position: relative;\n  cursor: pointer;\n  padding: 0;\n  display: flex;\n  align-items: center;\n  justify-content: flex-start;\n}\n.mom-publish-title {\n  font-size: 17px;\n  font-weight: 600;\n  color: var(--b3-theme-on-background, #333);\n  position: absolute;\n  left: 50%;\n  transform: translateX(-50%);\n}\n.mom-publish-submit {\n  font-size: 15px;\n  font-weight: 500;\n  color: var(--b3-theme-primary, #4e6ef2);\n  background-color: color-mix(in srgb, var(--b3-theme-primary, #4e6ef2) 10%, transparent);\n  padding: 6px 16px;\n  border-radius: 4px;\n  border: none;\n  cursor: pointer;\n}\n.mom-publish-content {\n  padding: 12px;\n  flex: 1 1 auto;\n  min-height: 0;\n  overflow-y: auto;\n  overflow-x: hidden;\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n}\n.mom-publish-card {\n  background: var(--b3-theme-background-light, #f7f7f7);\n  border: 1px solid color-mix(in srgb, var(--b3-border-color, #ddd) 45%, transparent);\n  border-radius: 12px;\n  padding: 14px;\n  box-sizing: border-box;\n}\n.mom-publish-card--editor {\n  flex: 0 0 auto;\n  display: flex;\n  flex-direction: column;\n}\n.mom-publish-card--editor:focus-within {\n  border-color: var(--b3-theme-primary, #4e6ef2);\n}\n.mom-publish-textarea {\n  width: 100%;\n  min-height: 90px;\n  max-height: 40vh;\n  border: none;\n  outline: none;\n  font-size: 16px;\n  line-height: 1.6;\n  color: var(--b3-theme-on-background, #333);\n  resize: vertical;\n  overflow-y: auto;\n  font-family: inherit;\n  background: transparent;\n}\n.mom-publish-textarea::placeholder {\n  color: #aaa;\n}\n.mom-publish-imgcard {\n  display: flex;\n  align-items: flex-start;\n  flex-wrap: wrap;\n  gap: 8px;\n}\n.mom-publish-grid-add,\n.mom-publish-grid-prev {\n  width: 56px;\n  height: 56px;\n  border: 1px dashed #ccc;\n  border-radius: 8px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n  position: relative;\n  overflow: hidden;\n  box-sizing: border-box;\n  background: transparent;\n  font-size: 22px;\n  color: #999;\n  flex: none;\n}\n.mom-publish-grid-prev {\n  border-style: solid;\n  border-color: #eee;\n}\n.mom-publish-grid-prev img {\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n  display: block;\n}\n.mom-publish-grid-prev-video {\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n  display: block;\n  background: #000;\n}\n.mom-publish-prev-media {\n  position: absolute;\n  inset: 0;\n}\n.mom-publish-prev-play {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  color: #fff;\n  font-size: 18px;\n  pointer-events: none;\n  text-shadow: 0 1px 3px rgba(0, 0, 0, .6);\n}\n.mom-publish-grid-x {\n  position: absolute;\n  top: 3px;\n  right: 3px;\n  width: 18px;\n  height: 18px;\n  background-color: #FA5151;\n  border-radius: 50%;\n  border: none;\n  color: #fff;\n  font-size: 11px;\n  line-height: 1;\n  cursor: pointer;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  z-index: 10;\n  padding: 0;\n}\n.mom-publish-inp {\n  flex: none;\n  width: 100%;\n  height: 30px;\n  border: 0.5px solid color-mix(in srgb, var(--b3-border-color, #ddd) 70%, transparent);\n  border-radius: 8px;\n  padding: 0 8px;\n  font-size: 13px;\n  color: var(--b3-theme-on-background, #333);\n  background: color-mix(in srgb, var(--b3-theme-background, #fff) 55%, transparent);\n  outline: none;\n  font-family: inherit;\n  box-sizing: border-box;\n}\n.mom-publish-info {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n}\n.mom-publish-info .mom-publish-inp[type=date] {\n  flex: 1;\n  min-width: 0;\n}\n.mom-publish-info .mom-publish-inp[data-location] {\n  flex: 2;\n  min-width: 0;\n}\n.mom-picker-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));\n  gap: 6px;\n  max-height: 60vh;\n  overflow-y: auto;\n  padding: 2px;\n}\n.mom-picker-item {\n  width: 100%;\n  aspect-ratio: 1;\n  border: 1px solid var(--b3-border-color, #eee);\n  border-radius: 6px;\n  background-size: cover;\n  background-position: center;\n  background-color: var(--b3-theme-background-light, #f4f4f4);\n  cursor: pointer;\n  padding: 0;\n  box-sizing: border-box;\n}\n.mom-picker-item:hover {\n  border-color: var(--b3-theme-primary, #4e6ef2);\n}\n.mom-list {\n  --moments-text: var(--b3-theme-on-background);\n  --moments-text-secondary: var(--b3-theme-on-surface);\n  --moments-border: var(--b3-border-color);\n  --moments-card-border: var(--b3-border-color);\n  --moments-name-color: var(--b3-theme-on-background);\n  --moments-close-color: var(--b3-theme-on-surface-light);\n  --moments-link-card-bg: var(--b3-theme-surface);\n  --moments-interaction-bg: var(--b3-theme-surface);\n  --moments-action-popup-bg: var(--b3-theme-surface);\n  --moments-action-popup-text: var(--b3-theme-on-background);\n  --moments-action-popup-border: var(--b3-border-color);\n  --moments-action-popup-active-bg: var(--b3-list-hover);\n}\n.north-luna-moments-item {\n  content-visibility: auto;\n  contain-intrinsic-size: auto 250px;\n  display: flex;\n  position: relative;\n  border-radius: 14px;\n  padding: 16px;\n  background-color: color-mix(in srgb, var(--b3-theme-surface) 45%, transparent);\n  width: calc(100% - 6%);\n  margin: 0 auto;\n  box-sizing: border-box;\n  border: 1px solid color-mix(in srgb, var(--b3-theme-on-background) 6%, transparent);\n  box-shadow: 0 1px 3px rgba(0, 0, 0, .04), 0 4px 14px rgba(0, 0, 0, .05);\n  transition: box-shadow 0.22s ease, transform 0.22s ease, border-color 0.22s ease;\n}\n.north-luna-moments-item:hover {\n  transform: translateY(-2px);\n  box-shadow: 0 4px 12px rgba(0, 0, 0, .07), 0 12px 28px rgba(0, 0, 0, .10);\n  border-color: color-mix(in srgb, var(--b3-theme-on-background) 10%, transparent);\n}\n.north-luna-moments-item.popup-open {\n  z-index: 8;\n}\n.north-luna-moments-item-content {\n  flex: 1;\n  min-width: 0;\n}\n.north-luna-moments-item-text {\n  font-size: 18px;\n  color: var(--moments-text);\n  line-height: 1.75;\n  margin-bottom: 6px;\n  word-wrap: break-word;\n  white-space: pre-wrap;\n  user-select: text;\n  -webkit-user-select: text;\n  overflow: hidden;\n}\n.north-luna-moments-no-text {\n  color: var(--moments-close-color);\n  font-size: 13px;\n}\n.north-luna-moments-item-text.moments-folded {\n  max-height: calc(var(--moments-fold-line-h, 32px) * var(--moments-fold-lines, 6));\n  -webkit-mask-image:\n    linear-gradient(\n      to bottom,\n      black calc(100% - 36px),\n      transparent 100%);\n  mask-image:\n    linear-gradient(\n      to bottom,\n      black calc(100% - 36px),\n      transparent 100%);\n  -webkit-mask-size: 100% 100%;\n  mask-size: 100% 100%;\n  -webkit-mask-repeat: no-repeat;\n  mask-repeat: no-repeat;\n}\n.north-luna-moments-item.moments-expanded .north-luna-moments-item-text.moments-folded {\n  max-height: none;\n  -webkit-mask-image: none;\n  mask-image: none;\n}\n.north-luna-moments-expand {\n  display: none;\n  align-items: center;\n  justify-content: flex-end;\n  gap: 2px;\n  margin-top: 4px;\n  margin-bottom: 10px;\n  color: var(--b3-theme-on-surface-light);\n  font-size: 13px;\n  cursor: pointer;\n  user-select: none;\n  -webkit-user-select: none;\n  transition: color 0.2s;\n}\n.north-luna-moments-expand:hover {\n  color: var(--b3-theme-primary);\n}\n.north-luna-moments-item.moments-has-fold .north-luna-moments-expand {\n  display: flex;\n}\n.north-luna-moments-expand .moments-expand-icon {\n  width: 14px;\n  height: 14px;\n}\n.north-luna-moments-item-text code,\n.north-luna-moments-item-text .mom-inline-code {\n  color: var(--b3-theme-primary);\n  background-color: color-mix(in srgb, var(--b3-theme-primary) 10%, transparent);\n  padding: 2px 4px;\n  border-radius: 7px;\n  font-size: 0.9em;\n  font-family: var(--b3-font-family-code, monospace);\n}\n.north-luna-moments-item-text mark {\n  background-color: #ffe08a;\n  padding: 0 2px;\n  border-radius: 2px;\n}\n.north-luna-moments-item-text strong {\n  font-weight: 600;\n}\n.north-luna-moments-media {\n  margin-bottom: 8px;\n}\n.north-luna-moments-video {\n  width: 100%;\n  max-height: 420px;\n  border-radius: 8px;\n  background: #000;\n  display: block;\n}\n.north-luna-moments-grid-cel {\n  position: relative;\n  display: block;\n  cursor: pointer;\n  overflow: hidden;\n  border-radius: 8px;\n}\n.north-luna-moments-grid-video-el {\n  width: 100%;\n  aspect-ratio: 1;\n  object-fit: cover;\n  display: block;\n  background: #000;\n}\n.north-luna-moments-image-grid.single .north-luna-moments-grid-video-el {\n  aspect-ratio: auto;\n  max-height: 280px;\n  width: 100%;\n}\n.north-luna-moments-grid-play {\n  position: absolute;\n  left: 50%;\n  top: 50%;\n  transform: translate(-50%, -50%);\n  width: 42px;\n  height: 42px;\n  border-radius: 50%;\n  background: rgba(0, 0, 0, .55);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  color: #fff;\n  pointer-events: none;\n}\n.north-luna-moments-grid-play svg {\n  width: 22px;\n  height: 22px;\n}\n.mom-lightbox video {\n  max-width: 92vw;\n  max-height: 80vh;\n  border-radius: 8px;\n  background: #000;\n}\n.north-luna-moments-image-grid {\n  display: grid;\n  gap: 4px;\n}\n.north-luna-moments-image-grid.single {\n  grid-template-columns: 1fr;\n  max-width: 300px;\n}\n.north-luna-moments-image-grid.double {\n  grid-template-columns: repeat(2, 1fr);\n  max-width: 300px;\n}\n.north-luna-moments-image-grid.triple {\n  grid-template-columns: repeat(3, 1fr);\n  max-width: 300px;\n}\n.north-luna-moments-image-grid.four {\n  grid-template-columns: repeat(2, 1fr);\n  max-width: 300px;\n}\n.north-luna-moments-image-grid.nine {\n  grid-template-columns: repeat(3, 1fr);\n  max-width: 300px;\n}\n.north-luna-moments-grid-img {\n  width: 100%;\n  aspect-ratio: 1;\n  object-fit: cover;\n  display: block;\n  cursor: zoom-in;\n  background: var(--b3-theme-surface);\n  transition: transform 0.3s ease;\n  border-radius: 8px;\n}\n.north-luna-moments-image-grid.single .north-luna-moments-grid-img {\n  aspect-ratio: auto;\n  max-height: 280px;\n  width: auto;\n  max-width: 100%;\n  border-radius: 6px;\n}\n.north-luna-moments-link-card {\n  display: flex;\n  align-items: center;\n  background-color: var(--moments-link-card-bg);\n  padding: 8px;\n  border-radius: 4px;\n  margin-bottom: 8px;\n  max-width: 220px;\n}\n.north-luna-moments-link-thumb {\n  width: 40px;\n  height: 40px;\n  border-radius: 4px;\n  object-fit: cover;\n  margin-right: 8px;\n  flex-shrink: 0;\n  background-color: #e0e0e0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n.north-luna-moments-link-info {\n  flex: 1;\n  min-width: 0;\n}\n.north-luna-moments-link-title {\n  font-size: 13px;\n  color: var(--moments-text);\n  line-height: 1.4;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n}\n.north-luna-moments-link-url {\n  font-size: 11px;\n  color: var(--moments-close-color);\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.north-luna-moments-item-meta {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  margin-top: 10px;\n  gap: 8px;\n  flex-wrap: nowrap;\n}\n.north-luna-moments-meta-tags {\n  display: flex;\n  align-items: center;\n  flex-wrap: wrap;\n  gap: 0;\n  flex: 1;\n  min-width: 0;\n  overflow: hidden;\n}\n.north-luna-moments-meta-item {\n  display: inline-flex;\n  align-items: center;\n  gap: 2px;\n  font-size: 12px;\n  color: var(--moments-text-secondary);\n  white-space: nowrap;\n  flex-shrink: 0;\n  line-height: 1.5;\n}\n.north-luna-moments-meta-item + .north-luna-moments-meta-item::before {\n  content: \"\\b7\";\n  margin: 0 7px;\n  color: var(--moments-text-secondary);\n  opacity: 0.4;\n  font-weight: bold;\n}\n.north-luna-moments-item-actions {\n  display: flex;\n  align-items: center;\n  justify-content: flex-start;\n  gap: 12px;\n  position: relative;\n  margin-top: 6px;\n}\n.north-luna-moments-liked-indicator {\n  display: inline-flex;\n  align-items: center;\n  flex-shrink: 0;\n  animation: moments-like-pop 0.3s ease;\n}\n.north-luna-moments-liked-indicator svg {\n  display: block;\n}\n@keyframes moments-like-pop {\n  0% {\n    transform: scale(1);\n  }\n  50% {\n    transform: scale(1.3);\n  }\n  100% {\n    transform: scale(1);\n  }\n}\n.north-luna-moments-pin-badge {\n  position: absolute;\n  top: 12px;\n  right: 12px;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  color: var(--b3-theme-primary);\n  opacity: 0.6;\n  pointer-events: none;\n}\n.north-luna-moments-more-btn {\n  width: 28px;\n  height: 24px;\n  background-color: transparent;\n  border: none;\n  border-radius: 6px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n  position: relative;\n  opacity: 0;\n  transition: opacity 0.2s ease, background-color 0.2s ease;\n}\n.north-luna-moments-item:hover .north-luna-moments-more-btn {\n  opacity: 1;\n}\n.north-luna-moments-more-btn:hover {\n  background-color: var(--moments-interaction-bg);\n}\n.north-luna-moments-more-btn::before {\n  content: \"\\22ef\";\n  font-size: 14px;\n  line-height: 1;\n  color: var(--moments-close-color);\n  letter-spacing: 1px;\n}\n.north-luna-moments-action-popup {\n  position: absolute;\n  right: 40px;\n  top: 50%;\n  transform: translateY(-50%);\n  background-color: var(--moments-action-popup-bg);\n  border: 1px solid var(--b3-border-color);\n  border-radius: 8px;\n  padding: 4px;\n  display: none;\n  flex-direction: column;\n  gap: 2px;\n  z-index: 10;\n  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.24);\n}\n.north-luna-moments-action-popup[data-mid] {\n  display: none;\n}\n.north-luna-moments-item.popup-open .north-luna-moments-action-popup {\n  display: flex;\n}\n.north-luna-moments-action-popup-row {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 2px;\n}\n.north-luna-moments-action-popup-btn {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  padding: 6px 10px;\n  font-size: 13px;\n  color: var(--moments-action-popup-text);\n  white-space: nowrap;\n  cursor: pointer;\n  border-radius: 6px;\n}\n.north-luna-moments-action-popup-btn:hover {\n  background-color: var(--moments-action-popup-active-bg);\n}\n.north-luna-moments-action-popup-btn:active {\n  background-color: var(--moments-action-popup-active-bg);\n}\n.north-luna-moments-action-popup-btn.like-btn.liked {\n  color: #e74c3c;\n}\n.north-luna-moments-action-popup-btn.like-btn.liked svg {\n  animation: moments-like-pop 0.3s ease;\n}\n.north-luna-moments-comment-panel {\n  margin-top: 8px;\n  padding: 8px 0 0;\n  animation: moments-likes-fade-in 0.2s ease;\n}\n.north-luna-moments-comment-panel:has(.north-luna-moments-comment-item) {\n  border-top: 1px solid rgba(128, 128, 128, 0.08);\n}\n.north-luna-moments-comment-item {\n  padding: 4px 0;\n  font-size: 13px;\n  line-height: 1.5;\n}\n.north-luna-moments-comment-display {\n  display: block;\n}\n.north-luna-moments-comment-text {\n  color: var(--b3-theme-on-surface);\n  word-break: break-all;\n  user-select: text;\n}\n.north-luna-moments-comment-text strong {\n  color: var(--b3-theme-primary);\n  font-weight: 600;\n}\n.north-luna-moments-comment-actions {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  margin-top: 4px;\n}\n.north-luna-moments-comment-actions-right {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n}\n.north-luna-moments-comment-time {\n  font-size: 11px;\n  color: var(--b3-theme-on-surface-light);\n  white-space: nowrap;\n}\n.north-luna-moments-comment-del {\n  display: inline-flex;\n  border: none;\n  background: transparent;\n  color: var(--b3-theme-on-surface-light);\n  cursor: pointer;\n  opacity: 0;\n  padding: 2px;\n  transition: opacity 0.15s;\n}\n.north-luna-moments-comment-item:hover .north-luna-moments-comment-del {\n  opacity: 1;\n}\n.north-luna-moments-comment-del:hover {\n  color: var(--b3-theme-on-surface);\n}\n.north-luna-moments-comment-input-row {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin-top: 8px;\n  padding-top: 6px;\n}\n.north-luna-moments-comment-input {\n  flex: 1;\n  border: none;\n  outline: none;\n  background: var(--b3-theme-surface);\n  border-radius: 7px;\n  padding: 6px 12px;\n  font-size: 13px;\n  color: var(--b3-theme-on-surface);\n  line-height: 1.4;\n}\n.north-luna-moments-comment-input::placeholder {\n  color: var(--b3-theme-on-surface-light);\n}\n.north-luna-moments-comment-panel .north-luna-moments-comment-send {\n  flex-shrink: 0;\n  border: none;\n  background: var(--b3-theme-primary);\n  color: #fff;\n  border-radius: 7px;\n  padding: 6px 18px;\n  min-width: 56px;\n  font-size: 13px;\n  font-weight: 600;\n  line-height: 1.3;\n  cursor: pointer;\n  transition: opacity 0.15s;\n  text-align: center;\n  white-space: nowrap;\n}\n.north-luna-moments-comment-panel .north-luna-moments-comment-send:hover {\n  opacity: 0.85;\n}\n@keyframes moments-likes-fade-in {\n  from {\n    opacity: 0;\n    transform: translateY(-4px);\n  }\n  to {\n    opacity: 1;\n    transform: translateY(0);\n  }\n}\n.north-luna-moments-item.mom-flash {\n  animation: mom-flash 1.6s ease;\n}\n.mom-list .north-luna-moments-date-group {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 10px;\n  margin: 4px 0 10px;\n  width: 100%;\n  box-sizing: border-box;\n}\n.mom-list .north-luna-moments-date-group::before,\n.mom-list .north-luna-moments-date-group::after {\n  content: \"\";\n  flex: 1;\n  height: 1px;\n  max-width: 90px;\n  background:\n    linear-gradient(\n      to right,\n      transparent,\n      color-mix(in srgb, var(--b3-theme-on-surface) 22%, transparent));\n}\n.mom-list .north-luna-moments-date-group::after {\n  background:\n    linear-gradient(\n      to left,\n      transparent,\n      color-mix(in srgb, var(--b3-theme-on-surface) 22%, transparent));\n}\n.mom-list .north-luna-moments-date-group-text {\n  font-size: 20px;\n  font-weight: 600;\n  color: var(--b3-theme-on-background);\n  letter-spacing: 0.4px;\n  white-space: nowrap;\n}\n.north-luna-moments-outline-popover {\n  width: 140px;\n  max-height: 320px;\n  overflow-y: auto;\n  background: var(--b3-theme-surface);\n  border: 1px solid var(--b3-border-color);\n  border-radius: 10px;\n  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);\n  z-index: 100;\n  padding: 6px 0;\n}\n.north-luna-moments-outline-title {\n  font-size: 12px;\n  font-weight: 600;\n  color: var(--b3-theme-on-surface-light);\n  padding: 6px 14px 8px;\n  border-bottom: 0.5px solid var(--b3-border-color);\n  margin-bottom: 4px;\n}\n.north-luna-moments-outline-item {\n  font-size: 14px;\n  color: var(--b3-theme-on-background);\n  padding: 8px 14px;\n  cursor: pointer;\n  transition: background 0.12s ease, color 0.12s ease;\n}\n.north-luna-moments-outline-item:hover {\n  background: var(--b3-list-hover);\n}\n.north-luna-moments-outline-item.active {\n  color: var(--b3-theme-primary);\n  font-weight: 600;\n  background: var(--b3-theme-primary-lightest);\n}\n\n/* 方案3：去掉\"⋯\"按钮，动态下方悬停淡入一行操作图标 */\n.north-luna-moments-more-btn,\n.north-luna-moments-action-popup {\n  display: none !important;\n}\n.north-luna-moments-action-bar {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n}\n.north-luna-moments-action-btn {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 31px;\n  height: 31px;\n  border: none;\n  border-radius: 7px;\n  background: transparent;\n  color: var(--b3-theme-on-surface-light);\n  cursor: pointer;\n  transition: background-color .15s ease, color .15s ease;\n}\n.north-luna-moments-action-btn svg {\n  width: 16px !important;\n  height: 16px !important;\n}\n.north-luna-moments-action-btn:hover,\n.north-luna-moments-action-btn:focus-visible {\n  background-color: var(--b3-theme-background-light);\n  color: var(--b3-theme-on-background);\n}\n.north-luna-moments-action-btn:focus-visible {\n  outline: 2px solid var(--b3-theme-primary, #4e6ef2);\n  outline-offset: 1px;\n}\n.north-luna-moments-action-btn.like-action.liked {\n  color: #e74c3c;\n}\n.north-luna-moments-action-btn.active {\n  color: var(--b3-theme-primary);\n}\n.north-luna-moments-action-btn.north-luna-moments-action-del {\n  color: #e05050;\n}\n.north-luna-moments-action-btn.north-luna-moments-action-del:hover {\n  color: #e05050;\n  background-color: #fdecec;\n}\n/* ===== 移动端：卡片尽量充满屏幕 ===== */\n@media (max-width: 480px) {\n  .north-luna-moments-item {\n    width: calc(100% - 6%);\n    margin: 0 auto;\n    padding: 12px;\n  }\n}\n\n/* ===== Orca Note + Apple HIG (appended by build.mjs) ===== */\n.orca-df-host {\n  flex: 1 1 auto;\n  align-self: stretch;\n  width: 100%;\n  min-width: 0;\n  height: 100%;\n  min-height: 0;\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n}\n.orca-df-scope .mom-root { height: 100%; width: 100%; min-width: 0; }\n/* ---- Apple / iOS-macOS tokens → legacy --b3-* ---- */\n.orca-df-scope {\n  --df-font: -apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"SF Pro Display\", \"Helvetica Neue\", Helvetica, Arial, sans-serif;\n  --df-font-mono: \"SF Mono\", ui-monospace, Menlo, Consolas, monospace;\n  --df-radius-sm: 6px;\n  --df-radius-md: 10px;\n  --df-radius-lg: 14px;\n  --df-radius-xl: 20px;\n  --df-radius-pill: 980px;\n  --df-stroke: 0.5px;\n  --df-shadow-4: 0 1px 2px rgba(0,0,0,.04), 0 2px 8px rgba(0,0,0,.06);\n  --df-shadow-8: 0 2px 8px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.08);\n  --df-shadow-16: 0 8px 28px rgba(0,0,0,.12), 0 2px 8px rgba(0,0,0,.04);\n  --df-brand: #007AFF;\n  --df-brand-hover: #0066D6;\n  --df-brand-pressed: #0055B3;\n  --df-brand-fg: #FFFFFF;\n  --df-brand-tint: rgba(0,122,255,.12);\n  --df-brand-tint-2: rgba(0,122,255,.20);\n  --df-fill-tertiary: rgba(120,120,128,.12);\n  --b3-theme-background: #F2F2F7;\n  --b3-theme-background-light: rgba(255,255,255,0.72);\n  --b3-theme-on-background: #000000;\n  --b3-theme-primary: var(--df-brand);\n  --b3-theme-primary-light: #5AC8FA;\n  --b3-theme-primary-lighter: var(--df-brand-tint-2);\n  --b3-theme-primary-lightest: var(--df-brand-tint);\n  --b3-theme-on-primary: var(--df-brand-fg);\n  --b3-border-color: rgba(60,60,67,0.18);\n  --b3-theme-surface: #FFFFFF;\n  --b3-theme-surface-lighter: #F2F2F7;\n  --b3-theme-on-surface: #000000;\n  --b3-theme-on-surface-light: #8E8E93;\n  --b3-list-hover: rgba(120,120,128,.12);\n  --b3-font-family-code: var(--df-font-mono);\n  --moments-card-border: rgba(60,60,67,0.12);\n  --moments-nav-border: rgba(60,60,67,0.18);\n  color: var(--b3-theme-on-background);\n  font-family: var(--df-font);\n  font-size: 15px;\n  line-height: 1.47;\n  letter-spacing: -0.01em;\n  -webkit-font-smoothing: antialiased;\n}\n.orca-df-scope.orca-df-dark {\n  --df-shadow-4: 0 1px 2px rgba(0,0,0,.35), 0 2px 8px rgba(0,0,0,.28);\n  --df-shadow-8: 0 2px 8px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35);\n  --df-shadow-16: 0 8px 28px rgba(0,0,0,.55);\n  --df-brand: #0A84FF;\n  --df-brand-hover: #409CFF;\n  --df-brand-pressed: #0066CC;\n  --df-brand-fg: #FFFFFF;\n  --df-brand-tint: rgba(10,132,255,.22);\n  --df-brand-tint-2: rgba(10,132,255,.32);\n  --df-fill-tertiary: rgba(120,120,128,.24);\n  --b3-theme-background: #000000;\n  --b3-theme-background-light: rgba(44,44,46,0.78);\n  --b3-theme-on-background: #FFFFFF;\n  --b3-theme-primary: var(--df-brand);\n  --b3-theme-primary-light: #64D2FF;\n  --b3-theme-primary-lighter: var(--df-brand-tint-2);\n  --b3-theme-primary-lightest: var(--df-brand-tint);\n  --b3-theme-on-primary: var(--df-brand-fg);\n  --b3-border-color: rgba(84,84,88,0.65);\n  --b3-theme-surface: #1C1C1E;\n  --b3-theme-surface-lighter: #2C2C2E;\n  --b3-theme-on-surface: #FFFFFF;\n  --b3-theme-on-surface-light: #8E8E93;\n  --b3-list-hover: rgba(120,120,128,.24);\n  --moments-card-border: rgba(84,84,88,0.45);\n  --moments-nav-border: rgba(84,84,88,0.65);\n}\n.orca-df-hb-icon { display: inline-flex; align-items: center; justify-content: center; }\n.orca-df-hb-icon svg { display: block; }\n/* ---- Surfaces / cards ---- */\n.orca-df-scope .mom-root {\n  background: var(--b3-theme-background);\n  font-family: var(--df-font);\n}\n.orca-df-scope .mom-item,\n.orca-df-scope .north-luna-moments-item {\n  width: 100%;\n  max-width: none;\n  margin-left: 0;\n  margin-right: 0;\n  background: var(--b3-theme-surface);\n  border: var(--df-stroke) solid var(--moments-card-border);\n  border-radius: var(--df-radius-lg);\n  box-shadow: var(--df-shadow-4);\n  transition: transform .18s cubic-bezier(.22,.61,.36,1), box-shadow .18s ease, background .18s ease;\n}\n.orca-df-scope .mom-item:hover,\n.orca-df-scope .north-luna-moments-item:hover {\n  box-shadow: var(--df-shadow-8);\n}\n.orca-df-scope .mom-list {\n  align-items: stretch;\n  padding-left: 16px;\n  padding-right: 16px;\n  gap: 12px;\n}\n.orca-df-scope .mom-filter-bar { width: 100%; }\n.orca-df-scope .mom-pin-strip {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px;\n  width: 100%;\n  margin: 0;\n  padding: 10px 16px 0;\n  box-sizing: border-box;\n  background: transparent;\n  border: none;\n  border-radius: 0;\n  cursor: default;\n}\n.orca-df-scope .mom-pin-strip-label {\n  writing-mode: horizontal-tb;\n  white-space: nowrap;\n  font-size: 13px;\n  font-weight: 400;\n  line-height: 1;\n  color: var(--orca-color-text-3, #8e8e93);\n  margin-right: 2px;\n}\n.orca-df-scope .mom-pin-strip-thumbs {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px;\n  flex: 1 1 auto;\n  min-width: 0;\n  overflow: visible;\n}\n.orca-df-scope .mom-pin-group-text {\n  display: inline-flex !important;\n  align-items: center;\n  gap: 6px;\n  max-width: min(100%, 320px);\n  height: 32px;\n  padding: 0 12px 0 10px;\n  border-radius: 8px;\n  border: 1px solid color-mix(in srgb, var(--df-brand, #007AFF) 22%, transparent);\n  background: color-mix(in srgb, var(--df-brand, #007AFF) 8%, var(--orca-color-bg-1, #fff));\n  color: var(--orca-color-text-1, #1c1c1e);\n  grid-template-columns: none !important;\n}\n.orca-df-scope .mom-pin-group-text:hover {\n  opacity: 1;\n  border-color: color-mix(in srgb, var(--df-brand, #007AFF) 45%, transparent);\n  background: color-mix(in srgb, var(--df-brand, #007AFF) 12%, var(--orca-color-bg-1, #fff));\n}\n.orca-df-scope .mom-pin-ico {\n  display: inline-flex;\n  flex-shrink: 0;\n  color: var(--df-brand, #007AFF);\n}\n.orca-df-scope .mom-pin-title {\n  min-width: 0;\n  font-size: 13px;\n  font-weight: 500;\n  line-height: 1.2;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.orca-df-scope .mom-pin-group-media {\n  display: grid;\n  gap: 2px;\n  padding: 3px;\n  border-radius: 8px;\n  border: 1px solid color-mix(in srgb, var(--df-brand, #007AFF) 22%, transparent);\n  background: color-mix(in srgb, var(--df-brand, #007AFF) 8%, var(--orca-color-bg-1, #fff));\n}\n.orca-df-scope .mom-pin-group-media .mom-pin-thumb img {\n  width: 28px;\n  height: 28px;\n  border-radius: 4px;\n}\n.orca-df-scope .mom-pin-group-media .mom-pin-thumb-single img {\n  width: 40px;\n  height: 40px;\n}\n.orca-df-scope .mom-pin-thumb-more {\n  font-size: 11px;\n}\n.orca-df-scope .mom-avatar,\n.orca-df-scope .mom-avatar-ph {\n  border-radius: var(--df-radius-md);\n}\n.orca-df-scope .north-luna-moments-item-name {\n  font-weight: 600;\n  letter-spacing: -0.02em;\n}\n/* ---- Controls ---- */\n.orca-df-scope button,\n.orca-df-scope input,\n.orca-df-scope textarea,\n.orca-df-scope select {\n  font-family: inherit;\n}\n.orca-df-scope .mom-publish-submit,\n.orca-df-scope .mom-empty-btn,\n.orca-df-scope .mom-btn-primary {\n  height: 34px;\n  min-width: 72px;\n  padding: 0 16px;\n  border: none;\n  border-radius: var(--df-radius-pill);\n  background: var(--df-brand);\n  color: var(--df-brand-fg);\n  font-size: 15px;\n  font-weight: 600;\n  letter-spacing: -0.01em;\n  line-height: 1;\n  box-shadow: none;\n  transition: opacity .15s ease, transform .15s ease, background .15s ease;\n}\n.orca-df-scope .mom-publish-submit:hover,\n.orca-df-scope .mom-empty-btn:hover,\n.orca-df-scope .mom-btn-primary:hover {\n  background: var(--df-brand-hover);\n  opacity: 0.96;\n}\n.orca-df-scope .mom-publish-submit:active,\n.orca-df-scope .mom-empty-btn:active,\n.orca-df-scope .mom-btn-primary:active {\n  background: var(--df-brand-pressed);\n  opacity: 0.88;\n}\n.orca-df-scope .mom-publish-inp,\n.orca-df-scope .mom-publish-textarea {\n  border: none;\n  border-radius: var(--df-radius-md);\n  background: var(--df-fill-tertiary);\n  transition: background .15s ease, box-shadow .15s ease;\n}\n.orca-df-scope .mom-publish-inp:hover,\n.orca-df-scope .mom-publish-textarea:hover {\n  background: color-mix(in srgb, var(--df-fill-tertiary) 85%, var(--df-brand) 15%);\n}\n.orca-df-scope .mom-publish-inp:focus,\n.orca-df-scope .mom-publish-textarea:focus,\n.orca-df-scope .mom-publish-card--editor:focus-within {\n  outline: none;\n  box-shadow: 0 0 0 3px var(--df-brand-tint);\n  background: var(--b3-theme-surface);\n}\n.orca-df-scope .mom-publish-card {\n  background: var(--b3-theme-surface);\n  border: var(--df-stroke) solid var(--moments-card-border);\n  border-radius: var(--df-radius-lg);\n  box-shadow: var(--df-shadow-4);\n}\n.orca-df-scope .mom-publish-nav {\n  height: 52px;\n  border-bottom: var(--df-stroke) solid var(--moments-nav-border);\n  background: color-mix(in srgb, var(--b3-theme-surface) 72%, transparent);\n  backdrop-filter: saturate(180%) blur(20px);\n  -webkit-backdrop-filter: saturate(180%) blur(20px);\n}\n.orca-df-scope .mom-publish-title {\n  font-size: 17px;\n  font-weight: 600;\n  letter-spacing: -0.02em;\n}\n.orca-df-scope .mom-publish-grid-add,\n.orca-df-scope .mom-publish-grid-prev {\n  border-radius: var(--df-radius-md);\n}\n.orca-df-scope .mom-fab-stack .mom-outline-fab,\n.orca-df-scope .mom-fab-stack .mom-tag-fab,\n.orca-df-scope .mom-fab,\n.orca-df-scope button.mom-outline-fab,\n.orca-df-scope button.mom-tag-fab {\n  width: 44px;\n  height: 44px;\n  border-radius: var(--df-radius-pill);\n  border: none;\n  background: color-mix(in srgb, var(--b3-theme-surface) 82%, transparent);\n  backdrop-filter: saturate(180%) blur(16px);\n  -webkit-backdrop-filter: saturate(180%) blur(16px);\n  box-shadow: var(--df-shadow-8);\n  color: var(--df-brand);\n}\n.orca-df-scope .mom-fab-stack .mom-outline-fab:hover,\n.orca-df-scope .mom-fab-stack .mom-tag-fab:hover,\n.orca-df-scope .mom-fab:hover {\n  background: var(--b3-theme-surface);\n}\n.orca-df-scope .mom-tag-fab.is-on {\n  color: var(--df-brand-fg);\n  background: var(--df-brand);\n  border-color: transparent;\n}\n.orca-df-scope .mom-cover-default {\n  background:\n    linear-gradient(160deg, #5AC8FA 0%, #007AFF 48%, #5856D6 100%);\n}\n.orca-df-scope.orca-df-dark .mom-cover-default {\n  background:\n    linear-gradient(160deg, #64D2FF 0%, #0A84FF 45%, #5E5CE6 100%);\n}\n.orca-df-scope .mom-cover-actions .mom-cover-settings,\n.orca-df-scope .mom-cover-actions button {\n  border-radius: var(--df-radius-pill);\n  border: none;\n  background: rgba(255,255,255,.28);\n  backdrop-filter: saturate(180%) blur(16px);\n  -webkit-backdrop-filter: saturate(180%) blur(16px);\n  color: #fff;\n}\n/* ---- Tags / chips ---- */\n.north-luna-moments-tags { display: flex; flex-wrap: wrap; gap: 6px 8px; margin-top: 10px; }\n.north-luna-moments-tag {\n  font-size: 13px;\n  line-height: 1.4;\n  color: var(--df-brand);\n  background: var(--df-brand-tint);\n  padding: 4px 10px;\n  border-radius: var(--df-radius-pill);\n  border: none;\n  cursor: pointer;\n  user-select: none;\n  transition: background .15s ease, opacity .15s ease;\n}\n.north-luna-moments-tag:hover { background: var(--df-brand-tint-2); }\n.mom-publish-info { flex-wrap: wrap; }\n.mom-publish-info .mom-publish-info-tags { flex: 1 1 100%; min-width: 0; margin-top: 4px; }\n/* ---- Empty ---- */\n.mom-empty { padding: 64px 28px 52px; text-align: center; }\n.mom-empty-ico { font-size: 48px; line-height: 1; margin-bottom: 14px; opacity: 0.9; }\n.mom-empty-title { font-size: 20px; font-weight: 700; letter-spacing: -0.03em; margin: 0 0 8px; color: var(--b3-theme-on-surface); }\n.mom-empty-sub { font-size: 15px; line-height: 1.5; margin: 0 0 6px; color: var(--b3-theme-on-surface-light); }\n.mom-empty-hint { font-size: 13px; line-height: 1.5; margin: 0 0 20px; color: var(--b3-theme-on-surface-light); opacity: 0.95; }\n.mom-empty-btn { margin-top: 4px; }\n/* ---- Tag bar / refs ---- */\n.orca-df-tagbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 16px 0; width: 100%; box-sizing: border-box; }\n.orca-df-tagbar-label { font-size: 13px; color: var(--b3-theme-on-surface-light); margin-right: 2px; }\n.orca-df-tagchip {\n  font-size: 13px;\n  line-height: 1.4;\n  padding: 5px 12px;\n  border-radius: var(--df-radius-pill);\n  border: none;\n  background: var(--df-fill-tertiary);\n  color: var(--b3-theme-on-background);\n  cursor: pointer;\n}\n.orca-df-tagchip.is-on, .orca-df-tagchip:hover {\n  background: var(--df-brand-tint);\n  color: var(--df-brand);\n}\n.orca-df-refs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }\n.orca-df-refchip {\n  font-size: 13px;\n  line-height: 1.4;\n  padding: 3px 10px;\n  border-radius: var(--df-radius-pill);\n  border: var(--df-stroke) dashed var(--b3-border-color);\n  background: transparent;\n  color: var(--b3-theme-on-surface-light);\n  cursor: pointer;\n}\n.orca-df-refchip:hover { color: var(--df-brand); border-color: var(--df-brand); background: var(--df-brand-tint); }\n.orca-df-open-orca {\n  font-size: 13px;\n  line-height: 1.4;\n  padding: 5px 10px;\n  border-radius: var(--df-radius-pill);\n  border: none;\n  background: transparent;\n  color: var(--df-brand);\n  font-weight: 600;\n  cursor: pointer;\n}\n.orca-df-open-orca:hover { background: var(--df-brand-tint); }\n.orca-df-loc-btn.is-on { color: var(--df-brand); }\n.orca-df-tag-btn.is-on { color: var(--df-brand); }\n.orca-df-actions-wrap,\n.orca-df-scope .north-luna-moments-item-actions {\n  position: relative;\n}\n.orca-df-scope .north-luna-moments-action-bar {\n  display: flex;\n  align-items: center;\n  gap: 2px;\n  justify-content: flex-start;\n  flex-wrap: nowrap;\n}\n.orca-df-scope .north-luna-moments-action-btn {\n  width: 34px;\n  height: 34px;\n  border-radius: var(--df-radius-pill);\n}\n.orca-df-more-inline {\n  display: none;\n  align-items: center;\n  gap: 2px;\n  margin-left: 2px;\n  padding-left: 4px;\n  border-left: var(--df-stroke) solid color-mix(in srgb, var(--b3-border-color) 80%, transparent);\n  animation: orca-df-more-in .16s ease;\n}\n.north-luna-moments-action-bar.is-more-open .orca-df-more-inline,\n.mom-action-bar.is-more-open .orca-df-more-inline {\n  display: inline-flex;\n}\n.north-luna-moments-action-bar.is-more-open .orca-df-more-btn,\n.mom-action-bar.is-more-open .orca-df-more-btn {\n  color: var(--df-brand);\n  background: var(--df-brand-tint);\n}\n.orca-df-more-inline .orca-df-more-del {\n  color: #FF3B30;\n}\n.orca-df-more-inline .orca-df-more-del:hover {\n  background: rgba(255,59,48,.1);\n}\n@keyframes orca-df-more-in {\n  from { opacity: 0; transform: translateX(-4px); }\n  to { opacity: 1; transform: translateX(0); }\n}\n.orca-df-tags-list {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px;\n  max-height: 220px;\n  overflow-y: auto;\n  margin-bottom: 12px;\n}\n.orca-df-tags-empty {\n  font-size: 13px;\n  color: var(--b3-theme-on-surface-light);\n  padding: 8px 0;\n}\n.orca-df-tagpick {\n  font-size: 13px;\n  line-height: 1.4;\n  padding: 4px 12px;\n  border-radius: var(--df-radius-pill);\n  border: var(--df-stroke) solid var(--b3-border-color);\n  background: var(--df-fill-tertiary);\n  color: var(--b3-theme-on-background);\n  cursor: pointer;\n}\n.orca-df-tagpick.is-on {\n  background: var(--df-brand-tint);\n  color: var(--df-brand);\n  border-color: var(--df-brand);\n}\n.orca-df-tags-add {\n  display: flex;\n  gap: 8px;\n  align-items: center;\n  margin-bottom: 8px;\n}\n.orca-df-tags-add .mom-inp { flex: 1 1 auto; min-width: 0; }\n.orca-df-loc-meta {\n  cursor: pointer;\n  color: var(--b3-theme-on-surface-light);\n}\n.orca-df-loc-meta:hover { color: var(--df-brand); }\n.orca-df-loc-pin { font-size: 12px; }\n.mom-publish-orca {\n  flex: none;\n  height: 34px;\n  padding: 0 14px;\n  margin-right: 0;\n  border: none;\n  border-radius: var(--df-radius-pill);\n  background: var(--df-fill-tertiary);\n  color: var(--df-brand);\n  font-size: 13px;\n  font-weight: 600;\n  cursor: pointer;\n}\n.mom-publish-orca:hover {\n  background: var(--df-brand-tint);\n}\n.mom-publish-nav-right { display: flex; align-items: center; gap: 8px; margin-left: auto; position: relative; z-index: 2; }\n.mom-publish-nav .mom-publish-back { position: relative; z-index: 2; border-radius: var(--df-radius-pill); color: var(--df-brand); }\n.mom-publish-nav .mom-publish-title { pointer-events: none; z-index: 0; }\n/* ---- Cover actions ---- */\n.mom-cover-actions {\n  position: absolute;\n  top: 14px;\n  right: 14px;\n  z-index: 12;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n.mom-cover-actions .mom-cover-settings {\n  position: static;\n  top: auto;\n  right: auto;\n}\n.mom-cover-signature {\n  position: absolute;\n  left: 16px;\n  right: 120px;\n  bottom: 22px;\n  z-index: 11;\n  margin: 0;\n  font-size: 15px;\n  line-height: 1.45;\n  font-weight: 500;\n  letter-spacing: 0.06em;\n  color: #fff;\n  text-shadow: 0 1px 2px rgba(0,0,0,.5), 0 2px 12px rgba(0,0,0,.35);\n  pointer-events: none;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.north-luna-moments-image-grid.nine {\n  grid-template-columns: repeat(3, 1fr);\n  max-width: 300px;\n}\n.north-luna-moments-grid-more {\n  position: relative;\n  display: block;\n  overflow: hidden;\n  border-radius: inherit;\n  cursor: pointer;\n}\n.north-luna-moments-grid-more .north-luna-moments-grid-img,\n.north-luna-moments-grid-more .north-luna-moments-grid-video-el {\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n  display: block;\n}\n.north-luna-moments-grid-more-badge {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: rgba(0,0,0,.46);\n  color: #fff;\n  font-size: 22px;\n  font-weight: 600;\n  letter-spacing: 0.02em;\n  pointer-events: none;\n  text-shadow: 0 1px 2px rgba(0,0,0,.35);\n}\n.north-luna-moments-item-text .orca-df-md-ul,\n.north-luna-moments-item-text .orca-df-md-ol {\n  margin: 4px 0 6px;\n  padding-left: 1.4em;\n  list-style-position: outside;\n}\n.north-luna-moments-item-text .orca-df-md-ul {\n  list-style-type: disc !important;\n}\n.north-luna-moments-item-text .orca-df-md-ol {\n  list-style-type: decimal !important;\n}\n.north-luna-moments-item-text .orca-df-md-ul .orca-df-md-ul { list-style-type: circle !important; }\n.north-luna-moments-item-text .orca-df-md-ul .orca-df-md-ul .orca-df-md-ul { list-style-type: square !important; }\n.north-luna-moments-item-text .orca-df-md-li {\n  margin: 2px 0;\n  line-height: 1.55;\n  display: list-item !important;\n}\n.north-luna-moments-item-text .orca-df-md-p {\n  margin: 0 0 4px;\n  line-height: 1.55;\n  white-space: pre-wrap;\n  word-break: break-word;\n}\n.north-luna-moments-item-text .orca-df-md-gap { height: 8px; }\n.north-luna-moments-item-text .orca-df-md-h {\n  font-weight: 650;\n  margin: 6px 0 4px;\n  line-height: 1.4;\n}\n.north-luna-moments-item-text .orca-df-md-h1 { font-size: 1.2em; }\n.north-luna-moments-item-text .orca-df-md-h2 { font-size: 1.1em; }\n.north-luna-moments-item-text .orca-df-md-h3 { font-size: 1.05em; }\n.north-luna-moments-item-text .orca-df-md-quote {\n  margin: 4px 0;\n  padding: 2px 0 2px 10px;\n  border-left: 3px solid var(--b3-border-color);\n  color: var(--b3-theme-on-surface-light);\n}\n.north-luna-moments-item-text .orca-df-md-code {\n  margin: 6px 0;\n  padding: 8px 10px;\n  border-radius: 8px;\n  background: var(--df-fill-tertiary);\n  overflow: auto;\n  font-size: 13px;\n  line-height: 1.45;\n}\n/* ---- Popover ---- */\n.orca-df-tag-popover {\n  position: fixed;\n  z-index: 2147483001;\n  min-width: 180px;\n  max-width: min(280px, calc(100vw - 24px));\n  max-height: min(360px, 50vh);\n  overflow: auto;\n  padding: 6px;\n  border-radius: var(--df-radius-lg);\n  background: color-mix(in srgb, var(--b3-theme-surface) 86%, transparent);\n  border: var(--df-stroke) solid var(--moments-card-border);\n  box-shadow: var(--df-shadow-16);\n  backdrop-filter: saturate(180%) blur(24px);\n  -webkit-backdrop-filter: saturate(180%) blur(24px);\n  box-sizing: border-box;\n}\n.orca-df-tag-popover-title {\n  font-size: 12px;\n  font-weight: 600;\n  color: var(--b3-theme-on-surface-light);\n  padding: 8px 10px 6px;\n  text-transform: uppercase;\n  letter-spacing: 0.04em;\n}\n.orca-df-tag-popover-item {\n  display: block;\n  width: 100%;\n  text-align: left;\n  border: none;\n  background: transparent;\n  color: var(--b3-theme-on-background);\n  font-size: 15px;\n  line-height: 1.35;\n  padding: 10px 12px;\n  border-radius: var(--df-radius-md);\n  cursor: pointer;\n}\n.orca-df-tag-popover-item:hover,\n.orca-df-tag-popover-item.is-on {\n  background: var(--df-brand-tint);\n  color: var(--df-brand);\n}\n.orca-df-tag-popover-empty {\n  font-size: 13px;\n  color: var(--b3-theme-on-surface-light);\n  padding: 12px 10px;\n}\n/* ---- Motion ---- */\n@media (prefers-reduced-motion: no-preference) {\n  .orca-df-scope .mom-item,\n  .orca-df-scope .north-luna-moments-item,\n  .orca-df-scope .mom-publish-submit,\n  .orca-df-scope .orca-df-tagchip,\n  .orca-df-scope .mom-outline-fab,\n  .orca-df-scope .mom-tag-fab {\n    transition: background .18s cubic-bezier(.22,.61,.36,1), border-color .18s ease, box-shadow .18s ease, color .18s ease, transform .18s cubic-bezier(.22,.61,.36,1), opacity .15s ease;\n  }\n  .orca-df-scope .mom-outline-fab:active,\n  .orca-df-scope .mom-tag-fab:active,\n  .orca-df-scope .mom-publish-submit:active {\n    transform: scale(0.96);\n  }\n}\n/* ---- 正文观感仍对齐虎鲸字号变量 ---- */\n.orca-df-scope {\n  --moments-text: var(--orca-color-text-1, var(--b3-theme-on-background, #000));\n  --df-body-font: var(--orca-fontfamily-ui, var(--orca-font-family, var(--df-font)));\n  --df-body-size: var(--orca-fontsize, 15px);\n  --df-body-leading: var(--orca-block-line-height, var(--orca-lineheight-md, 1.47));\n}\n.orca-df-scope .north-luna-moments-item-text,\n.orca-df-scope .mom-publish-textarea,\n.orca-df-scope .mom-publish-card--editor .mom-publish-textarea {\n  font-family: var(--df-body-font);\n  font-size: var(--df-body-size);\n  line-height: var(--df-body-leading);\n  color: var(--moments-text);\n  letter-spacing: -0.01em;\n  font-weight: 400;\n}\n.orca-df-scope .north-luna-moments-no-text {\n  color: var(--orca-color-text-3, var(--b3-theme-on-surface-light, #8E8E93));\n  font-size: var(--df-body-size);\n  line-height: var(--df-body-leading);\n}\n.orca-df-scope .mom-inline-code,\n.orca-df-scope .north-luna-moments-item-text code {\n  font-family: var(--orca-fontfamily-code, var(--df-font-mono));\n  font-size: 0.92em;\n  line-height: inherit;\n  background: var(--df-fill-tertiary);\n  border-radius: 4px;\n  padding: 0.1em 0.35em;\n}\n.orca-df-scope .north-luna-moments-item-text a,\n.orca-df-scope .north-luna-moments-item-text .mom-md-link {\n  color: var(--orca-color-primary-5, var(--df-brand));\n}\n/* ---- 卡片正文层级：正文 > 列表 > meta 日期 ---- */\n.orca-df-scope .mom-item,\n.orca-df-scope .north-luna-moments-item {\n  padding: 12px 14px 10px;\n}\n.orca-df-scope .north-luna-moments-item-header {\n  margin-bottom: 6px;\n  gap: 8px;\n}\n.orca-df-scope .north-luna-moments-item-header .mom-avatar,\n.orca-df-scope .north-luna-moments-item-header .mom-avatar-ph {\n  width: 34px;\n  height: 34px;\n  font-size: 14px;\n}\n.orca-df-scope .north-luna-moments-item-name {\n  font-size: 14px;\n  font-weight: 600;\n  color: var(--orca-color-text-2, var(--b3-theme-on-surface, #3A3A3C));\n}\n.orca-df-scope .north-luna-moments-item-text {\n  margin-bottom: 2px;\n  line-height: 1.55;\n}\n.orca-df-scope .north-luna-moments-item-text > .orca-df-md-p:first-child {\n  color: var(--moments-text);\n  font-weight: 450;\n}\n.orca-df-scope .north-luna-moments-item-text .orca-df-md-ul,\n.orca-df-scope .north-luna-moments-item-text .orca-df-md-ol {\n  margin: 6px 0 2px;\n  color: color-mix(in srgb, var(--moments-text) 86%, transparent);\n  font-size: 0.96em;\n}\n.orca-df-scope .north-luna-moments-item-text .orca-df-md-li {\n  line-height: 1.5;\n  margin: 1px 0;\n}\n.orca-df-scope .north-luna-moments-item-text .orca-df-md-p + .orca-df-md-ul,\n.orca-df-scope .north-luna-moments-item-text .orca-df-md-p + .orca-df-md-ol {\n  margin-top: 4px;\n}\n.orca-df-scope .north-luna-moments-tags {\n  margin-top: 6px;\n  margin-bottom: 0;\n}\n.orca-df-scope .north-luna-moments-item-meta {\n  margin-top: 8px;\n  margin-bottom: 0;\n}\n.orca-df-scope .north-luna-moments-meta-item {\n  font-size: 11px;\n  line-height: 1.35;\n  letter-spacing: 0.01em;\n  color: var(--orca-color-text-3, var(--b3-theme-on-surface-light, #8E8E93));\n  opacity: 0.92;\n}\n.orca-df-scope .north-luna-moments-meta-item + .north-luna-moments-meta-item::before {\n  margin: 0 6px;\n  opacity: 0.35;\n  font-weight: 500;\n}\n.orca-df-scope .north-luna-moments-item-actions {\n  margin-top: 4px;\n}\n.orca-df-scope .north-luna-moments-comment-panel {\n  margin-top: 6px;\n}\n.orca-df-scope .orca-df-inline-ref {\n  display: inline;\n  text-decoration: none;\n  border-bottom: 1px dashed color-mix(in srgb, var(--df-brand, #007AFF) 55%, transparent);\n  cursor: pointer;\n}\n.orca-df-scope .orca-df-inline-ref:hover {\n  border-bottom-style: solid;\n}\n.orca-df-refresh-fab svg { display: block; }\n.orca-df-time-hint {\n  margin: 10px 0 0;\n  font-size: 12px;\n  line-height: 1.4;\n  color: var(--orca-color-text-3, #8e8e93);\n}\n.orca-df-scope .north-luna-moments-item-text,\n.orca-df-scope .mom-item-text {\n  cursor: pointer;\n}\n.orca-df-load-more {\n  display: flex;\n  justify-content: center;\n  padding: 16px 12px 28px;\n}\n.orca-df-load-more-btn {\n  appearance: none;\n  border: 1px solid color-mix(in srgb, var(--orca-color-text-3, #8e8e93) 35%, transparent);\n  background: color-mix(in srgb, var(--orca-color-bg-1, #fff) 92%, transparent);\n  color: var(--orca-color-text-2, #636366);\n  border-radius: 999px;\n  padding: 8px 18px;\n  font-size: 13px;\n  line-height: 1.3;\n  cursor: pointer;\n}\n.orca-df-load-more-btn:hover {\n  color: var(--orca-color-text-1, #1c1c1e);\n  border-color: color-mix(in srgb, var(--df-brand, #007AFF) 45%, transparent);\n}\n.orca-df-trash-fab { position: relative; }\n.orca-df-trash-fab-count,\n.orca-df-archive-fab-count,\n.orca-df-tools-fab-count {\n  position: absolute; top: -4px; right: -4px;\n  min-width: 16px; height: 16px; padding: 0 4px;\n  border-radius: 999px; background: var(--orca-color-accent, #0F6CBD);\n  color: #fff; font-size: 10px; font-weight: 600; line-height: 16px; text-align: center;\n}\n.orca-df-tools-fab { position: relative; }\n.orca-df-trash-backdrop {\n  position: fixed; inset: 0; z-index: 2147482999;\n  display: flex; align-items: center; justify-content: center;\n  background: rgba(0, 0, 0, 0.30);\n}\n.orca-df-trash-pop {\n  z-index: 2147483000; width: 560px; max-width: calc(100vw - 48px); max-height: 76vh;\n  display: flex; flex-direction: column; padding: 20px 24px 24px;\n  border-radius: 10px; background: var(--orca-color-bg-1, #fff);\n  color: var(--orca-color-text-1, #1c1c1e);\n  border: 1px solid var(--orca-color-border, rgba(0,0,0,0.08));\n  box-shadow: var(--orca-shadow-modal, 0 32px 64px rgba(0,0,0,0.24));\n  font-size: 14px; line-height: 1.5;\n}\n.orca-df-trash-head {\n  display: flex; align-items: center; justify-content: space-between;\n  padding: 2px 0 14px; font-size: 18px; font-weight: 600;\n}\n.orca-df-trash-head-tools { display: flex; align-items: center; gap: 10px; }\n.orca-df-trash-hint { font-size: 12px; font-weight: 400; color: var(--orca-color-text-3, #8e8e93); }\n.orca-df-trash-close {\n  appearance: none; border: 0; background: transparent; cursor: pointer;\n  font-size: 22px; line-height: 1; color: var(--orca-color-text-3, #8e8e93);\n}\n.orca-df-trash-body { overflow: auto; flex: 1 1 auto; min-height: 120px; }\n.orca-df-trash-empty { padding: 28px 8px; text-align: center; color: var(--orca-color-text-3, #8e8e93); }\n.orca-df-trash-row {\n  display: flex; align-items: center; justify-content: space-between; gap: 12px;\n  padding: 12px 4px; border-top: 1px solid var(--orca-color-border, rgba(0,0,0,0.06));\n}\n.orca-df-trash-meta { min-width: 0; flex: 1 1 auto; }\n.orca-df-trash-title {\n  font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\n}\n.orca-df-trash-sub { margin-top: 2px; font-size: 12px; color: var(--orca-color-text-3, #8e8e93); }\n.orca-df-trash-actions { display: flex; gap: 8px; flex-shrink: 0; }\n.orca-df-trash-act {\n  appearance: none; border: 1px solid var(--orca-color-border, rgba(0,0,0,0.12));\n  background: transparent; border-radius: 6px; padding: 4px 10px; cursor: pointer;\n  color: var(--orca-color-text-2, #636366); font-size: 13px;\n}\n.orca-df-trash-act.danger { color: var(--orca-color-danger, #c42b1c); border-color: color-mix(in srgb, var(--orca-color-danger, #c42b1c) 35%, transparent); }\n.orca-df-trash-foot { padding-top: 14px; display: flex; justify-content: flex-end; }\n.orca-df-archive-fab { position: relative; }\n.orca-df-archive-backdrop {\n  position: fixed; inset: 0; z-index: 2147482999;\n  display: flex; align-items: center; justify-content: center;\n  background: rgba(0, 0, 0, 0.30);\n}\n.orca-df-archive-pop {\n  z-index: 2147483000; width: 560px; max-width: calc(100vw - 48px); max-height: 76vh;\n  display: flex; flex-direction: column; padding: 20px 24px 24px;\n  border-radius: 10px; background: var(--orca-color-bg-1, #fff);\n  color: var(--orca-color-text-1, #1c1c1e);\n  border: 1px solid var(--orca-color-border, rgba(0,0,0,0.08));\n  box-shadow: var(--orca-shadow-modal, 0 32px 64px rgba(0,0,0,0.24));\n  font-size: 14px; line-height: 1.5;\n}\n.orca-df-archive-head {\n  display: flex; align-items: center; justify-content: space-between;\n  padding: 2px 0 14px; font-size: 18px; font-weight: 600;\n}\n.orca-df-archive-head-tools { display: flex; align-items: center; gap: 10px; }\n.orca-df-archive-hint { font-size: 12px; font-weight: 400; color: var(--orca-color-text-3, #8e8e93); }\n.orca-df-archive-close {\n  appearance: none; border: 0; background: transparent; cursor: pointer;\n  font-size: 22px; line-height: 1; color: var(--orca-color-text-3, #8e8e93);\n}\n.orca-df-archive-body { overflow: auto; flex: 1 1 auto; min-height: 120px; }\n.orca-df-archive-empty { padding: 28px 8px; text-align: center; color: var(--orca-color-text-3, #8e8e93); }\n.orca-df-archive-row {\n  display: flex; align-items: center; justify-content: space-between; gap: 12px;\n  padding: 12px 4px; border-top: 1px solid var(--orca-color-border, rgba(0,0,0,0.06));\n}\n.orca-df-archive-meta { min-width: 0; flex: 1 1 auto; }\n.orca-df-archive-title {\n  font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\n}\n.orca-df-archive-sub { margin-top: 2px; font-size: 12px; color: var(--orca-color-text-3, #8e8e93); }\n.orca-df-archive-actions { display: flex; gap: 8px; flex-shrink: 0; }\n.orca-df-archive-act {\n  appearance: none; border: 1px solid var(--orca-color-border, rgba(0,0,0,0.12));\n  background: transparent; border-radius: 6px; padding: 4px 10px; cursor: pointer;\n  color: var(--orca-color-text-2, #636366); font-size: 13px;\n}\n.orca-df-outline-backdrop {\n  position: fixed; inset: 0; z-index: 2147482999;\n  display: flex; align-items: stretch; justify-content: center;\n  background: rgba(0, 0, 0, 0.28);\n}\n.orca-df-outline-pop {\n  z-index: 2147483000; width: min(420px, 100vw); max-width: 100vw;\n  max-height: min(92vh, 900px); margin: auto 0;\n  display: flex; flex-direction: column;\n  background: var(--orca-color-bg-1, #fff);\n  color: var(--orca-color-text-1, #1c1c1e);\n  border-radius: 12px 12px 0 0;\n  box-shadow: var(--orca-shadow-modal, 0 24px 48px rgba(0,0,0,0.22));\n  overflow: hidden;\n}\n@media (min-width: 720px) {\n  .orca-df-outline-pop {\n    width: min(480px, calc(100vw - 48px)); max-height: 82vh; margin: auto;\n    border-radius: 12px;\n  }\n}\n.orca-df-outline-head {\n  display: flex; align-items: center; gap: 4px;\n  padding: 10px 12px 8px; font-size: 17px; font-weight: 600;\n  border-bottom: 1px solid var(--orca-color-border, rgba(0,0,0,0.06));\n}\n.orca-df-outline-back {\n  appearance: none; border: 0; background: transparent; cursor: pointer;\n  width: 36px; height: 36px; border-radius: 10px;\n  display: inline-flex; align-items: center; justify-content: center;\n  color: var(--orca-color-text-1, #1c1c1e);\n}\n.orca-df-outline-back:hover { background: color-mix(in srgb, var(--df-brand, #007AFF) 10%, transparent); }\n.orca-df-outline-head-spacer { width: 36px; }\n.orca-df-outline-years { padding: 12px 16px 0; display: flex; flex-direction: column; gap: 6px; }\n.orca-df-outline-year-row { display: flex; gap: 6px; }\n.orca-df-outline-year,\n.orca-df-outline-year-ph {\n  flex: 1 1 0; min-width: 0; height: 40px;\n}\n.orca-df-outline-year {\n  appearance: none; cursor: pointer;\n  border-radius: 10px; font-size: 13px; font-weight: 600;\n  border: 1px solid color-mix(in srgb, var(--df-brand, #007AFF) 40%, transparent);\n  background: color-mix(in srgb, var(--df-brand, #007AFF) 10%, transparent);\n  color: var(--df-brand, #007AFF);\n}\n.orca-df-outline-year.is-on {\n  background: var(--df-brand, #007AFF);\n  border-color: color-mix(in srgb, var(--df-brand, #007AFF) 85%, transparent);\n  color: #fff;\n}\n.orca-df-outline-hint {\n  padding: 6px 16px 8px; font-size: 12px;\n  color: var(--orca-color-text-3, #8e8e93);\n}\n.orca-df-outline-months {\n  flex: 1 1 auto; min-height: 120px; overflow: auto;\n  padding: 4px 16px 16px;\n  display: grid; grid-template-columns: 1fr 1fr; gap: 6px; align-content: start;\n}\n.orca-df-outline-month {\n  appearance: none; cursor: pointer; height: 40px; padding: 0 8px;\n  display: flex; align-items: center; gap: 6px; min-width: 0;\n  border-radius: 10px;\n  border: 1px solid color-mix(in srgb, var(--df-brand, #007AFF) 40%, transparent);\n  background: color-mix(in srgb, var(--df-brand, #007AFF) 10%, transparent);\n  color: var(--df-brand, #007AFF);\n  font-size: 13px; font-weight: 600;\n}\n.orca-df-outline-month:hover {\n  border-color: color-mix(in srgb, var(--df-brand, #007AFF) 85%, transparent);\n}\n.orca-df-outline-cal { flex-shrink: 0; opacity: 0.95; }\n.orca-df-outline-month-label {\n  flex: 1 1 auto; min-width: 0;\n  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left;\n}\n.orca-df-outline-month-count {\n  flex-shrink: 0; font-size: 12px; font-weight: 500;\n  color: var(--orca-color-text-3, #8e8e93);\n}\n.orca-df-outline-empty {\n  grid-column: 1 / -1; padding: 24px 8px; text-align: center;\n  color: var(--orca-color-text-3, #8e8e93); font-size: 14px; font-weight: 400;\n}\n.orca-df-scope .mom-calendar-content {\n  max-width: min(680px, 96vw) !important;\n}\n.orca-df-scope .mom-calendar-content:has(.mom-calendar-heat-wrap) {\n  width: min(680px, 96vw) !important;\n}\n.orca-df-scope .mom-calendar-heat-wrap {\n  display: flex;\n  flex-direction: column;\n  gap: 20px;\n  padding: 8px 8px 12px;\n  width: 100%;\n  box-sizing: border-box;\n}\n.orca-df-scope .mom-calendar-heat-half {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  padding-bottom: 14px;\n  border-bottom: 1px solid color-mix(in srgb, var(--orca-color-border, rgba(0,0,0,0.08)) 80%, transparent);\n}\n.orca-df-scope .mom-calendar-heat-half:last-child {\n  border-bottom: none;\n  padding-bottom: 0;\n}\n.orca-df-scope .mom-calendar-heat-caption {\n  font-size: 13px;\n  font-weight: 500;\n  color: var(--orca-color-text-3, #8e8e93);\n}\n.orca-df-scope .mom-calendar-heat-empty {\n  font-size: 14px;\n  color: var(--orca-color-text-3, #8e8e93);\n  padding: 16px 0;\n}\n.orca-df-scope .mom-calendar-heat-wrap .mom-calendar-columns {\n  display: flex;\n  gap: 4px;\n  width: 100%;\n  justify-content: space-between;\n}\n.orca-df-scope .mom-calendar-heat-wrap .mom-calendar-column {\n  flex: 1 1 0;\n  min-width: 12px;\n  max-width: 18px;\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n.orca-df-scope .mom-calendar-heat-wrap .mom-calendar-cell {\n  width: 100%;\n  min-width: 12px;\n  min-height: 12px;\n  aspect-ratio: 1;\n  border-radius: 4px;\n  background-color: #EBEDF0;\n  transition: transform .12s ease;\n  cursor: default;\n  box-shadow: none;\n}\n.orca-df-scope .mom-calendar-cell[data-date] { cursor: pointer; }\n.orca-df-scope .mom-calendar-heat-wrap .mom-calendar-cell:hover {\n  transform: scale(1.18);\n  box-shadow: none;\n  outline: 1px solid color-mix(in srgb, var(--df-brand, #007AFF) 55%, transparent);\n  outline-offset: 0;\n  z-index: 1;\n}\n.orca-df-scope .mom-calendar-cell.level-empty {\n  background-color: transparent;\n  opacity: 0;\n  pointer-events: none;\n}\n.orca-df-scope .mom-calendar-cell.level-empty:hover {\n  transform: none;\n  outline: none;\n}\n.orca-df-scope .mom-calendar-cell.level-0 { background-color: #EBEDF0; }\n.orca-df-scope .mom-calendar-cell.level-1 { background-color: #B6E3FF; }\n.orca-df-scope .mom-calendar-cell.level-2 { background-color: #54AEFF; }\n.orca-df-scope .mom-calendar-cell.level-3 { background-color: #218BFF; }\n.orca-df-scope .mom-calendar-cell.level-4 { background-color: #0550AE; }\n.orca-df-scope .mom-calendar-heat-wrap .mom-calendar-months {\n  position: relative;\n  margin-top: 6px;\n  height: 20px;\n  min-width: 0;\n  width: 100%;\n}\n.orca-df-scope .mom-calendar-heat-wrap .mom-calendar-month-label {\n  position: absolute;\n  transform: translateX(-50%);\n  font-size: 13px;\n  color: var(--orca-color-text-3, #8e8e93);\n  white-space: nowrap;\n}\n/* ---- Tools / stats / export / images / layout ---- */\n.orca-df-quickbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 16px 0; width: 100%; box-sizing: border-box; }\n.orca-df-quick-kw { font-size: 12px; color: var(--orca-color-text-3, #8e8e93); }\n.orca-df-scope .mom-fab-stack .orca-df-search-fab.is-on,\n.orca-df-scope .mom-fab-stack .orca-df-tools-fab.is-on {\n  color: var(--df-brand-fg);\n  background: var(--df-brand);\n  border-color: transparent;\n}\n.orca-df-layout-compact .mom-cover { height: clamp(110px, 16vh, 180px); }\n.orca-df-layout-compact .mom-list, .orca-df-layout-compact .north-luna-moments-list { padding-left: 12px; padding-right: 12px; }\n.orca-df-layout-tall .mom-cover { height: clamp(220px, 34vh, 380px); }\n.orca-df-tools-backdrop, .orca-df-images-backdrop {\n  position: fixed; inset: 0; z-index: 2147482999;\n  display: flex; align-items: center; justify-content: center;\n  background: rgba(0, 0, 0, 0.30);\n}\n.orca-df-tools-pop {\n  z-index: 2147483000; width: 440px; max-width: calc(100vw - 48px); max-height: 80vh;\n  display: flex; flex-direction: column; padding: 20px 24px 24px;\n  border-radius: 10px; background: var(--orca-color-bg-1, #fff);\n  color: var(--orca-color-text-1, #1c1c1e);\n  border: 1px solid var(--orca-color-border, rgba(0,0,0,0.08));\n  box-shadow: var(--orca-shadow-modal, 0 32px 64px rgba(0,0,0,0.24));\n  font-size: 14px; line-height: 1.5;\n}\n.orca-df-tools-wide { width: 560px; }\n.orca-df-tools-head {\n  display: flex; align-items: center; justify-content: space-between; gap: 12px;\n  padding: 2px 0 14px; font-size: 18px; font-weight: 600;\n}\n.orca-df-tools-head-tools { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }\n.orca-df-tools-close {\n  appearance: none; border: 0; background: transparent; cursor: pointer;\n  font-size: 22px; line-height: 1; color: var(--orca-color-text-3, #8e8e93);\n}\n.orca-df-tools-body { overflow: auto; flex: 1 1 auto; min-height: 80px; display: flex; flex-direction: column; gap: 10px; }\n.orca-df-tools-muted { font-size: 13px; color: var(--orca-color-text-3, #8e8e93); }\n.orca-df-tools-label { font-size: 13px; font-weight: 500; }\n.orca-df-tools-input {\n  width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 8px;\n  border: 1px solid var(--orca-color-border, rgba(0,0,0,0.12));\n  background: var(--orca-color-bg-2, #f5f5f7); color: inherit; font-size: 14px;\n}\n.orca-df-tools-tile {\n  appearance: none; text-align: left; cursor: pointer;\n  display: flex; flex-direction: column; gap: 4px;\n  padding: 12px 14px; border-radius: 10px;\n  border: 1px solid var(--orca-color-border, rgba(0,0,0,0.08));\n  background: var(--orca-color-bg-2, #f5f5f7); color: inherit;\n}\n.orca-df-tools-tile:hover { border-color: var(--df-brand, #007AFF); }\n.orca-df-tools-tile b { font-size: 15px; }\n.orca-df-tools-tile span { font-size: 12px; color: var(--orca-color-text-3, #8e8e93); }\n.orca-df-tools-btn {\n  appearance: none; cursor: pointer; text-align: left;\n  padding: 10px 14px; border-radius: 8px;\n  border: 1px solid var(--orca-color-border, rgba(0,0,0,0.12));\n  background: transparent; color: inherit; font-size: 14px;\n}\n.orca-df-tools-btn.primary, .orca-df-tools-btn.is-on {\n  background: var(--df-brand, #007AFF); color: #fff; border-color: transparent;\n}\n.orca-df-tools-mini {\n  appearance: none; cursor: pointer; padding: 4px 10px; border-radius: 6px;\n  border: 1px solid var(--orca-color-border, rgba(0,0,0,0.12));\n  background: transparent; color: var(--orca-color-text-2, #636366); font-size: 13px;\n}\n.orca-df-tools-mini:disabled { opacity: 0.4; cursor: default; }\n.orca-df-tools-actions { display: flex; flex-wrap: wrap; gap: 8px; }\n.orca-df-tools-status { font-size: 13px; color: var(--orca-color-text-2, #636366); }\n.orca-df-tools-sec { margin-top: 8px; }\n.orca-df-tools-sec-t { font-weight: 600; margin-bottom: 6px; }\n.orca-df-tools-row {\n  display: flex; justify-content: space-between; gap: 12px;\n  padding: 6px 0; border-top: 1px solid var(--orca-color-border, rgba(0,0,0,0.06));\n}\n.orca-df-stats-grid {\n  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px;\n}\n@media (max-width: 520px) { .orca-df-stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }\n.orca-df-stats-card {\n  padding: 12px 10px; border-radius: 10px;\n  background: var(--orca-color-bg-2, #f5f5f7); text-align: center;\n}\n.orca-df-stats-n { font-size: 22px; font-weight: 700; letter-spacing: -0.03em; }\n.orca-df-stats-l { font-size: 12px; color: var(--orca-color-text-3, #8e8e93); margin-top: 2px; }\n.orca-df-tools-entry {\n  display: flex; align-items: center; justify-content: space-between; gap: 12px;\n  padding: 10px 0; border-top: 1px solid var(--orca-color-border, rgba(0,0,0,0.06));\n}\n.orca-df-tools-entry-main { min-width: 0; flex: 1; }\n.orca-df-tools-entry-t { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.orca-df-img-list { display: flex; flex-direction: column; gap: 8px; }\n.orca-df-img-row { display: flex; align-items: center; gap: 10px; }\n.orca-df-img-thumb { width: 56px; height: 56px; object-fit: cover; border-radius: 8px; background: #eee; flex-shrink: 0; }\n.orca-df-img-meta { flex: 1; min-width: 0; }\n.orca-df-img-acts { display: flex; gap: 4px; flex-shrink: 0; }\n.orca-df-img-progress { height: 4px; border-radius: 2px; background: var(--orca-color-bg-2, #eee); overflow: hidden; }\n.orca-df-img-progress-bar { height: 100%; background: var(--df-brand, #007AFF); transition: width .2s ease; }\n.orca-df-list-search {\n  min-width: 110px; flex: 1 1 auto; height: 26px; padding: 0 8px;\n  border-radius: 7px; border: 1px solid var(--orca-color-border, rgba(0,0,0,.12));\n  background: var(--orca-color-bg-2, rgba(120,120,128,.08)); color: inherit;\n  font: inherit; font-size: 13px; outline: none;\n}\n.orca-df-list-search::placeholder { color: var(--orca-color-text-3, #8e8e93); }\n.orca-df-list-more { display: flex; justify-content: center; padding: 10px 0; }\n.orca-df-archive-foot { display: flex; justify-content: flex-end; padding: 8px 0 0; }\n.orca-df-media-list { max-height: 46vh; overflow: auto; margin: 6px 0 10px; }\n.orca-df-search-quick { display: flex; flex-wrap: wrap; gap: 12px; padding: 2px 0 10px; }\n.orca-df-search-check { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; }\n.orca-df-search-dates { display: flex; align-items: center; gap: 8px; padding: 0 0 10px; }\n.orca-df-list-sort { height: 26px; padding: 0 6px; border-radius: 7px; border: 1px solid var(--orca-color-border, rgba(0,0,0,.12)); background: var(--orca-color-bg-2, rgba(120,120,128,.08)); color: inherit; font: inherit; font-size: 13px; outline: none; }\n/* ---- 封面日历：照片模式两列（一屏显示两个月） ---- */\n.mom-calendar-photo-twocol { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 22px; align-items: start; }\n.mom-calendar-photo-row { grid-template-columns: repeat(7, minmax(32px, 1fr)); }\n.mom-calendar-photo-cell { max-width: none; }\n@media (max-width: 720px) { .mom-calendar-photo-twocol { grid-template-columns: 1fr; } }\n/* ---- 快速撰写 / 心情天气 ---- */\n.orca-df-compose-modal { max-width: 520px; width: 92%; }\n.orca-df-compose-text { width: 100%; min-height: 84px; resize: vertical; box-sizing: border-box; }\n.orca-df-compose-imgs { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 0; }\n.orca-df-compose-img { position: relative; width: 64px; height: 64px; border-radius: 8px; overflow: hidden; background: var(--orca-color-bg-2, #eee); }\n.orca-df-compose-img img { width: 100%; height: 100%; object-fit: cover; display: block; }\n.orca-df-compose-img-x { position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; border: 0; border-radius: 50%; background: rgba(0,0,0,.55); color: #fff; line-height: 1; cursor: pointer; }\n.orca-df-compose-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 8px; }\n.orca-df-compose-row .mom-inp { flex: 1 1 auto; min-width: 0; }\n.orca-df-compose-mood { flex: 0 0 84px; }\n.orca-df-compose-weather { flex: 0 0 84px; }\n.orca-df-compose-loc { flex: 1 1 110px; min-width: 0; }\n.orca-df-meta-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 2px; }\n.orca-df-meta-chip { font-size: 12px; padding: 1px 8px; border-radius: 980px; background: var(--orca-color-bg-2, rgba(120,120,128,.1)); color: var(--orca-color-text-2, #555); }\n.orca-df-img-row { cursor: grab; }\n.orca-df-img-row.is-dragging { opacity: .45; }\n.orca-df-img-cap { width: 100%; box-sizing: border-box; height: 24px; font-size: 12px; padding: 0 6px; border-radius: 6px; border: 1px solid var(--orca-color-border, rgba(0,0,0,.1)); background: transparent; color: inherit; margin-bottom: 2px; }\n.orca-df-captions { display: flex; flex-direction: column; gap: 2px; margin: 6px 0 2px; }\n.orca-df-caption { font-size: 12px; color: var(--orca-color-text-3, #8e8e93); }";

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
    { label: en ? "Blank" : "空白", text: "" },
    { label: en ? "Three things" : "今天的三件事", text: en ? "Three things today:\n1. \n2. \n3. " : "今天的三件事：\n1. \n2. \n3. " },
    { label: en ? "Gratitude" : "感恩", text: en ? "Grateful for:\n- " : "今天想感谢：\n- " },
    { label: en ? "Review" : "复盘", text: en ? "What went well:\n- \nTo improve:\n- " : "做得好的：\n- \n可以改进：\n- " },
    { label: en ? "Travel" : "行程", text: en ? "Where:\nWhat happened:\n" : "地点：\n行程：\n" }
  ];
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
        '<select class="mom-inp orca-df-compose-tpl" data-template>' +
          '<option value="">' + orcaEsc(dfT("模板")) + "</option>" +
          orcaComposeTemplates().map(function (t, ti) {
            return '<option value="' + ti + '">' + orcaEsc(t.label) + "</option>";
          }).join("") +
        "</select>" +
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
    if (e.target.closest("[data-add-img]")) { fileInput.click(); return; }
    if (e.target.closest("[data-publish-open]")) { submit(true); return; }
    if (e.target.closest("[data-publish]")) { submit(false); return; }
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
  if (tplSel) {
    tplSel.addEventListener("change", function () {
      var idx = Number(tplSel.value);
      var tpls = orcaComposeTemplates();
      if (!tpls[idx]) return;
      var text = tpls[idx].text || "";
      if (!text) { tplSel.value = ""; return; }
      if (ta.value.trim() && !window.confirm(dfT("用模板覆盖当前内容？"))) { tplSel.value = ""; return; }
      ta.value = text;
      try { ta.focus(); } catch (eF) { /* ignore */ }
      tplSel.value = "";
    });
  }
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
        '<button type="button" class="north-luna-moments-action-btn" data-df-act="manage-images" data-id="' + orcaEsc(it.id) + '" data-mid="' + orcaEsc(it.id) + '" title="' + orcaEsc(dfT("管理图片")) + '" aria-label="' + orcaEsc(dfT("管理图片")) + '"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></button>' +
        (bid && isFinite(Number(bid))
          ? '<button type="button" class="north-luna-moments-action-btn" data-df-act="open-orca" data-block-id="' + orcaEsc(String(bid)) + '" title="' + orcaEsc(dfT("在虎鲸中打开")) + '" aria-label="' + orcaEsc(dfT("在虎鲸中打开")) + '"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M19 19H5V5h7V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"></path></svg></button>'
          : "") +
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

/** 仅本地化 feed 内 vendor 控件/空状态的静态文案，绝不触碰用户内容 */
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
