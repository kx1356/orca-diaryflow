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
      liked: !!overlay.liked,
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
  var ttl = DF_TRASH_RETENTION_DAYS * 864e5;
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
    liked: !!(record.overlay && record.overlay.liked),
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
    liked: !!(record.overlay && record.overlay.liked),
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
  return { blockId: newId, title: record.title };
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
  var ttl = DF_TRASH_RETENTION_DAYS * 864e5;
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

// 挂到 OrcaBlocks（本文件在 orca-blocks.js 之后拼接）
(function dfAttachTrashApi() {
  var api = {
    trashList: trashList,
    trashCount: trashCount,
    restoreTrashItem: restoreTrashItem,
    purgeTrashItem: purgeTrashItem,
    purgeAllTrash: purgeAllTrash,
    purgeExpiredTrash: purgeExpiredTrash,
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
