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
