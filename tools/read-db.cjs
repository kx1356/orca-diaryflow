// 用 node:sqlite 读取 Plugin 表
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("C:/Users/i5156/Documents/orca/app.db", { readOnly: true });
try {
  const rows = db.prepare("SELECT name, enabled, length(schema) as schema_len, substr(settings,1,120) as settings_head FROM Plugin ORDER BY name").all();
  console.log("Plugin rows:", rows.length);
  for (const r of rows) {
    console.log(`${r.enabled ? "[ON] " : "[off]"} ${r.name}  (schema:${r.schema_len}, settings:${r.settings_head || "-"})`);
  }
} catch (e) {
  console.error("query failed:", e.message);
  // 列出所有表
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log("tables:", tables.map((t) => t.name).join(", "));
  } catch (e2) {
    console.error(e2.message);
  }
}
