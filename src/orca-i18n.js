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
  "粗体": "Bold",
  "斜体": "Italic",
  "删除线": "Strikethrough",
  "下划线": "Underline",
  "行内代码": "Inline code",
  "高亮": "Highlight",
  "链接": "Link",
  "保存为模板": "Save as template",
  "删除模板": "Delete template",
  "模板名称": "Template name",
  "保存": "Save",
  "自定义模板": "Custom template",
  "模板内容为空": "Template content is empty",
  "已保存模板": "Template saved",
  "已删除模板": "Template deleted",
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
  "添加图片": "Add images",
  "失败": "Failed",
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
  "正文原生渲染（实验）": "Native entry body (experimental)",
  "卡片正文改用虎鲸原生块渲染，尽量完整显示表格/颜色/嵌入等格式；如异常请关闭":
    "Render card body with Orca's native block renderer to show tables/colors/embeds; turn off if it misbehaves",
  "备份保留份数": "Backups to keep",
  "自动备份最多保留的份数": "Maximum number of auto backups to keep",
  "年度报告": "Year in review",
  "年度统计，可导出长图 / PDF": "Annual stats; export as long image / PDF",
  "字数": "Words",
  "导出长图": "Export long image",
  "打印 / PDF": "Print / PDF",
  "正在生成…": "Generating…",
  "已导出长图": "Long image exported",
  "打印窗口被拦截": "Print window blocked",
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
