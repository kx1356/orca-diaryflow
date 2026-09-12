// i18n + 筛选逻辑单元测试（纯函数）
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const i18n = readFileSync(join(ROOT, "src", "orca-i18n.js"), "utf8");
const tools = readFileSync(join(ROOT, "src", "orca-tools.js"), "utf8");

function load(locale) {
  const ctx = { orca: { state: { locale } }, console };
  vm.createContext(ctx);
  vm.runInContext(i18n, ctx);
  vm.runInContext(tools, ctx);
  return ctx;
}

const en = load("en-US");
const zh = load("zh-CN");
const results = [];
function check(name, cond) { results.push([name, !!cond]); }

check("dfT en translates label", en.dfT("标签筛选") === "Tag filter");
check("dfT zh passthrough", zh.dfT("标签筛选") === "标签筛选");
check("dfT preserves user text around key", en.dfT("已恢复：雨天") === "Restored: 雨天");
check("cal title en", en.dfCalMonthTitle(2026, 0) === "Jan 2026");
check("cal title zh", zh.dfCalMonthTitle(2026, 0) === "2026年1月");
check("cal tip zh", zh.dfCalTip(0, 5, 3) === "1月5日: 3条");
check("cal tip en", en.dfCalTip(11, 31, 0) === "Dec 31");

const items = [
  { created: "2026-01-10 09:00", images: [1], location: "A", pinned: false },
  { created: "2026-03-01 09:00", images: [], location: "", pinned: true },
  { created: "2026-05-20 09:00", images: [], location: "", pinned: false }
];
check("date range filter", en.orcaToolsQuickFilterItems(items, { dateFrom: "2026-02-01", dateTo: "2026-04-30" }).length === 1);
check("date from only", en.orcaToolsQuickFilterItems(items, { dateFrom: "2026-03-01" }).length === 2);
check("date to only", en.orcaToolsQuickFilterItems(items, { dateTo: "2026-02-01" }).length === 1);
check("pinned only", en.orcaToolsQuickFilterItems(items, { pinnedOnly: true }).length === 1);
check("hasImage", en.orcaToolsQuickFilterItems(items, { hasImage: true }).length === 1);
check("hasLocation", en.orcaToolsQuickFilterItems(items, { hasLocation: true }).length === 1);
check("hasQuick includes date", en.orcaToolsHasQuickFilters({ dateFrom: "2026-01-01" }) === true);
check("hasQuick false when empty", en.orcaToolsHasQuickFilters({}) === false);

let ok = true;
for (const [n, c] of results) {
  console.log((c ? "ok  " : "FAIL") + " " + n);
  if (!c) ok = false;
}
console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
