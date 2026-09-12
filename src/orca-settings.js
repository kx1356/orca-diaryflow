// ============================================================
// src/orca-settings.js — 插件设置页（orca.plugins.setSettingsSchema）
// 设置值同步读取 orca.state.plugins[name].settings；未设置时用默认值。
// ============================================================

var DF_SETTINGS_DEFAULTS = {
  itemsPerPage: 25,
  trashRetentionDays: 30,
  confirmDelete: true,
  autoCleanImages: false
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
      }
    });
  } catch (e) {
    console.warn("[orca-diaryflow] setSettingsSchema failed", e);
  }
}
