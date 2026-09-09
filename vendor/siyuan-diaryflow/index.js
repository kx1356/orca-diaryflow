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
        location: m.location || ""
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
      if (avatar) return `<img class="mom-avatar" src="${esc(avatar)}" alt="">`;
      return `  <div class="mom-avatar mom-avatar-ph">${esc((nickname || "\u6708").slice(0, 1))}</div>`;
    }
    var ICONS = {
      upload: "iconUpload",
      image: "iconImage",
      calendar: "iconCalendar",
      trash: "iconTrashcan",
      settings: "iconSettings",
      edit: "iconEdit",
      pin: "iconPin",
      clock: "iconClock",
      mark: "iconMark"
    };
    function ico(name, size) {
      const s = size || 16;
      const dim = `style="width:${s}px;height:${s}px;fill:currentColor"`;
      if (name === "outline") return `<svg viewBox="0 0 24 24" ${dim}><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>`;
      if (name === "heart") return `<svg viewBox="0 0 24 24" ${dim}><path fill="#e74c3c" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>`;
      const id = ICONS[name] || name;
      return `<svg viewBox="0 0 24 24" ${dim}><use xlink:href="#${id}"></use></svg>`;
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
          <div class="mom-signature-tools">
            <button class="mom-cover-tool" data-act="upload" title="\u4E0A\u4F20\u672C\u5730\u56FE\u7247">${ico("upload")}<span>\u4E0A\u4F20</span></button>
            <button class="mom-cover-tool" data-act="resource" title="\u4ECE\u8D44\u6E90\u5E93\u9009\u62E9">${ico("image")}<span>\u8D44\u6E90</span></button>
            <button class="mom-cover-tool" data-act="calendar" title="\u65E5\u8BB0\u6D41\u65E5\u5386">${ico("calendar")}<span>\u65E5\u5386</span></button>
            <button class="mom-cover-tool mom-cover-tool-danger" data-act="delete" title="\u5220\u9664\u5E76\u6062\u590D\u9ED8\u8BA4">${ico("trash")}<span>\u5220\u9664</span></button>
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
          const t = (it.text || "").toLowerCase();
          if (!t.includes(f.kw.toLowerCase())) return false;
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
          : `<div class="mom-empty"><div class="mom-empty-ico">\u{1F4CB}</div><p class="mom-empty-title">\u8FD8\u6CA1\u6709\u52A8\u6001</p><p class="mom-empty-sub">\u8BB0\u5F55\u4E0B\u8FD9\u4E00\u523B\uFF0C\u8BA9\u65E5\u5B50\u53EF\u4EE5\u56DE\u5934\u3002</p><button class="mom-btn mom-btn-primary mom-empty-btn" data-action="open-editor" type="button">\uFF0B \u53D1\u5E03\u7B2C\u4E00\u6761</button></div>`;
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
        const ids = { pin: "iconPin", edit: "iconEdit", trash: "iconTrashcan", clock: "iconClock", mark: "iconMark" };
        svg = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><use xlink:href="#${ids[dataAction]}"></use></svg>`;
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
              <span class="north-luna-moments-comment-del" data-mid="${mid}" data-id="${mid}" data-cid="${cid}" data-action="del-comment" title="\u5220\u9664"><svg class="icon" style="width:12px;height:12px;"><use xlink:href="#iconClose"></use></svg></span>
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
      const pinBadge = it.pinned ? `<div class="north-luna-moments-pin-badge" title="\u5DF2\u7F6E\u9876"><svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><use xlink:href="#iconPin"></use></svg></div>` : "";
      return `
    <div class="north-luna-moments-item" data-mid="${esc(it.id)}" data-id="${esc(it.id)}" data-date="${esc(dateKey(toTs(it)))}">
      ${pinBadge}
      <div class="north-luna-moments-item-content">
        ${cardHeaderHtml(ctx)}
        ${textHtml(it)}
        ${expandHtml(it)}
        ${mediaHtml(it)}
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
        (it.images || []).forEach((src, i) => lines.push(`
![\u56FE${i + 1}](${src})`));
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
      const body = items.map((it) => {
        const meta = metaLine(it);
        const imgs = (it.images || []).map((src) => `<div style="margin:6px 0"><img src="${src}" style="max-width:100%"></div>`).join("");
        return `<div style="margin:0 0 18px">
        <div style="color:#666">${esc(fmtDisplay(it.created || ""))}</div>
        ${meta ? `<div style="color:#888">${esc(meta)}</div>` : ""}
        <div style="white-space:pre-wrap">${esc(it.text || "")}</div>
        ${imgs}
        ${it.link ? `<div style="color:#1662af"><a href="${esc(it.link)}">${esc(it.link)}</a></div>` : ""}
        ${it.comments && it.comments.length ? `<div style="background:#f2f2f2;padding:6px 8px;margin-top:6px">${it.comments.map((c) => `${esc(c.name || "\u6211")}\uFF1A${esc(c.text)}`).join("<br>")}</div>` : ""}
      </div>`;
      }).join("\n");
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
          item.innerHTML = `<div class="north-luna-moments-comment-display"><span class="north-luna-moments-comment-text"><strong>${esc(c.name)}\uFF1A</strong>${esc(c.text)}</span><span class="north-luna-moments-comment-actions"><span class="north-luna-moments-comment-time">${ctime}</span><span class="north-luna-moments-comment-actions-right"><span class="north-luna-moments-comment-del" data-mid="${esc(it.id)}" data-id="${esc(it.id)}" data-cid="${esc(c.id)}" data-action="del-comment" title="\u5220\u9664"><svg class="icon" style="width:12px;height:12px;"><use xlink:href="#iconClose"></use></svg></span></span></span></div>`;
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
      video.src = src;
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
    const ASSET_DIR = "/data/widgets/diaryflow-assets/";
    const ASSET_URL = "/widgets/diaryflow-assets/";
    async function ensureAssetDir() {
      const fd = new FormData();
      fd.append("path", ASSET_DIR);
      fd.append("isDir", "true");
      fd.append("file", new Blob([]), "");
      try {
        await fetch("/api/file/putFile", { method: "POST", body: fd });
      } catch (e) {
      }
    }
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
      await ensureAssetDir();
      const ext = (file.name && file.name.match(/\.([a-z0-9]+)$/i) || [, "bin"])[1].toLowerCase();
      const name = `df_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const fd = new FormData();
      fd.append("path", ASSET_DIR + name);
      fd.append("file", file, name);
      fd.append("isDir", "false");
      try {
        const resp = await fetch("/api/file/putFile", { method: "POST", body: fd });
        const json = await resp.json().catch(() => null);
        if (json && json.code === 0) return ASSET_URL + name;
      } catch (e) {
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
      const token = window.siyuan && siyuan.config && siyuan.config.api && siyuan.config.api.token || "";
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = "Token " + token;
      const names = [];
      try {
        const resp = await fetch("/api/file/readDir", { method: "POST", headers, body: JSON.stringify({ path: ASSET_DIR }) });
        const result = await resp.json();
        if (result.code === 0 && Array.isArray(result.data)) {
          result.data.filter((e) => !e.isDir).forEach((e) => names.push(e.name));
        }
      } catch (e) {
      }
      const imgs = names.filter((n) => /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(n));
      const overlay = overlayBase();
      overlay.innerHTML = `
    <div class="mom-modal mom-modal-sm">
      <div class="mom-modal-head"><span>\u4ECE\u65E5\u8BB0\u6D41\u8D44\u6E90\u9009\u62E9\u5C01\u9762</span><button class="mom-modal-x" data-x>\u2715</button></div>
      <div class="mom-picker-grid">${imgs.length ? imgs.map((n) => `<button class="mom-picker-item" data-path="${esc(n)}" title="${esc(n)}" style="background-image:url(&quot;${ASSET_URL}${encodeURIComponent(n)}&quot;)"></button>`).join("") : '<div class="mom-empty">\u6682\u65E0\u53EF\u7528\u56FE\u7247</div>'}</div>
    </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.remove();
        if (e.target.closest("[data-x]")) overlay.remove();
        const item = e.target.closest("[data-path]");
        if (item) {
          setCover(ctx, ASSET_URL + item.dataset.path);
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
      const d = { text: "", link: "", linkTitle: "", location: "", images: [] };
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
      div.className = "mom-overlay " + (cls || "");
      return div;
    }
    function toISO(ts) {
      const d = new Date(ts);
      return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
    }
    module2.exports = { register, openEditor, openSettings };
  }
});

// src/index.js
var { Plugin, getFrontend, showMessage } = require("siyuan");
var storage = require_storage();
var render = require_render();
var editor = require_editor();
var TAB_TYPE = "moments-tab";
var MomentsPlugin = class extends Plugin {
  onload() {
    const self = this;
    self.isMobile = getFrontend() === "mobile" || getFrontend() === "browser-mobile";
    self.__moments = storage.defaultData();
    self.__ready = false;
    self.__readyCbs = [];
    const ctx = {
      plugin: self,
      filters: { kw: "" },
      view: "feed",
      // feed=列表 / calendar=日历
      calYear: (/* @__PURE__ */ new Date()).getFullYear(),
      // 日历当前年份
      mounts: [],
      data: () => self.__moments,
      save: () => storage.saveData(self, self.__moments),
      showMessage: (m) => {
        try {
          showMessage(m);
        } catch (_) {
        }
      }
    };
    ctx.reApp = () => {
      ctx.mounts.forEach((c) => render.renderApp(c, ctx));
    };
    const mount = (container) => {
      const el = container && (container.element || container);
      if (el && el.style) {
        el.style.height = "100%";
        el.style.minHeight = "0";
        el.style.overflow = "hidden";
        el.style.position = "relative";
      }
      render.renderApp(container, ctx);
      editor.register(ctx, container);
      if (!ctx.mounts.includes(container)) ctx.mounts.push(container);
    };
    const whenReady = (fn) => {
      if (self.__ready) fn();
      else self.__readyCbs.push(fn);
    };
    storage.loadData(self).then((d) => {
      self.__moments = d;
      self.__ready = true;
      const cbs = self.__readyCbs;
      self.__readyCbs = [];
      cbs.forEach((fn) => {
        try {
          fn();
        } catch (e) {
          console.error(e);
        }
      });
    });
    self.addTab({
      type: TAB_TYPE,
      init() {
        const el = this.element;
        whenReady(() => mount(el));
      }
    });
    self.addDock({
      type: "moments-dock",
      config: {
        position: "LeftBottom",
        size: { width: 320, height: 0 },
        icon: "iconGlobe",
        title: "\u65E5\u8BB0\u6D41",
        hotkey: "CtrlShiftM"
      },
      data: {},
      init: (container) => {
        const el = container.element;
        whenReady(() => mount(el));
      },
      destroy: () => {
      }
    });
  }
  onunload() {
  }
};
module.exports = MomentsPlugin;
