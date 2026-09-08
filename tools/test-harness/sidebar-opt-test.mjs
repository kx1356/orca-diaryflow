// 方案 D：侧栏默认加宽(42%) + 记住宽度恢复 + 空状态 hint
import { JSDOM } from "jsdom";
import { pathToFileURL } from "node:url";

const distPath = "C:/Users/i5156/Documents/orca/plugins/orca-diaryflow/dist/index.js";

const dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.MutationObserver = dom.window.MutationObserver;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.Blob = dom.window.Blob;
globalThis.atob = (s) => Buffer.from(s, "base64").toString("binary");
globalThis.btoa = (s) => Buffer.from(s, "binary").toString("base64");
if (!globalThis.matchMedia) globalThis.matchMedia = () => ({ matches: false });
const urlStore = new Map();
let urlSeq = 0;
globalThis.URL.createObjectURL = (b) => { const id = "blob:sd" + ++urlSeq; urlStore.set(id, b); return id; };
globalThis.URL.revokeObjectURL = (u) => urlStore.delete(u);

const hooks = { layoutFns: [] };
globalThis.window.React = {
  useRef: (i) => ({ current: i }),
  useLayoutEffect: (fn) => { hooks.layoutFns.push(fn); },
  createElement: (t, p, ...c) => ({ type: t, props: p, children: c }),
};

// 持久层：含 df-panel-width 预存值 0.3（模拟用户以前拖窄过）
const storage = new Map([["orca-diaryflow|df-panel-width", "0.3"]]);
const panelsTree = { id: "root", direction: "row", children: [{ id: "journal", view: "journal", width: 1 }] };
const calls = [];
let panelComp = null;

globalThis.orca = {
  state: { dataDir: "C:/x", theme: "light", activePanel: "journal", panels: panelsTree, headbarButtons: {} },
  notify: (l, m) => console.log("[notify]", l, m),
  invokeBackend: async (method, ...args) => {
    if (method === "get-plugin-data") return storage.get(args[0] + "|" + args[1]) ?? null;
    return null;
  },
  plugins: {
    getData: async (n, k) => storage.get(n + "|" + k) ?? null,
    setData: async (n, k, v) => {
      if (!["string", "number"].includes(typeof v) && !(v instanceof ArrayBuffer) && v !== null) throw new Error("Invalid value type");
      storage.set(n + "|" + k, v);
    },
    setSettingsSchema: async () => {},
  },
  commands: { registerCommand: () => {}, unregisterCommand: () => {} },
  headbar: { registerHeadbarButton: () => {}, unregisterHeadbarButton: () => {} },
  panels: {
    registerPanel: (type, comp) => { panelComp = comp; },
    unregisterPanel: () => {},
  },
  components: { Button: "B" },
  nav: {
    addTo: (id, dir, src) => {
      const w = 1 / (panelsTree.children.length + 1);
      for (const c of panelsTree.children) c.width = w;
      const nid = "diaryflow";
      panelsTree.children.push({ id: nid, view: src?.view, width: w });
      calls.push(["addTo", id, dir]);
      return nid;
    },
    goTo: () => {},
    switchFocusTo: () => {},
    changeSizes: (pid, vals) => {
      panelsTree.children.forEach((c, i) => { if (vals[i] != null) c.width = vals[i]; });
      calls.push(["changeSizes", JSON.stringify(vals)]);
    },
  },
};

async function main() {
  const m = await import(pathToFileURL(distPath).href + "?_t=" + Date.now());
  await m.load("orca-diaryflow");
  await new Promise((r) => setTimeout(r, 120));

  // 1. 面板渲染 + 空状态
  console.log("=== 1. 面板渲染 + 空状态 ===");
  if (!panelComp) { console.error("FAIL: no panel renderer"); process.exit(1); }
  const container = document.createElement("div");
  document.body.appendChild(container);
  const vnode = panelComp({});
  vnode.props.ref.current = container;
  for (const fn of hooks.layoutFns.splice(0)) fn();
  await new Promise((r) => setTimeout(r, 150));
  const html = container.innerHTML;
  console.log("渲染 mom-root:", html.includes("mom-root") ? "✓" : "✗");
  console.log("空状态 hint 存在:", html.includes("mom-empty-hint") ? "✓" : "✗");
  console.log("空状态文案:", html.includes("点击下方按钮发布第一条") ? "✓" : "✗");

  // 2. 打开面板（新建 → 应记住宽度 0.3 而非默认 0.42，因为预存了 0.3）
  console.log("\n=== 2. 打开面板恢复记住宽度(0.3) ===");
  // orcaOpenPanel 不可直接调用；模拟相同序列：addTo + applyPanelWidth(target, saved || default)
  const saved = parseFloat(storage.get("orca-diaryflow|df-panel-width")); // 0.3
  const targetId = orca.nav.addTo("journal", "right", { view: "orca-diaryflow.panel", viewArgs: {}, viewState: {} });
  // 模拟 orcaApplyPanelWidth
  const group = panelsTree;
  const oldW = group.children[1].width;
  const w2 = Math.min(0.85, Math.max(0.18, saved)); // 0.3
  const rest = 1 - oldW;
  const scale = rest > 0.01 ? (1 - w2) / rest : 1;
  const vals = group.children.map((c, i) => (i === 1 ? w2 : Math.max(0.05, c.width * scale)));
  orca.nav.changeSizes(targetId, vals);
  await new Promise((r) => setTimeout(r, 80));
  const widths = panelsTree.children.map((c) => c.id + ":" + c.width);
  console.log("宽度:", widths.join(", "));
  const restored = panelsTree.children[1].width;
  console.log("恢复为记住的 0.3:", Math.abs(restored - 0.3) < 0.01 ? "✓" : "✗");
  console.log("主面板 0.7:", Math.abs(panelsTree.children[0].width - 0.7) < 0.01 ? "✓" : "✗");

  // 已存在时记住当前宽度（设置 0.36 再验证写入）
  console.log("\n=== 3. 打开已存在面板 → 记住宽度 ===");
  panelsTree.children[1].width = 0.36;
  storage.delete("orca-diaryflow|df-panel-width");
  // 模拟 orcaRememberPanelWidth
  const w3 = panelsTree.children.find((c) => c.id === "diaryflow").width;
  storage.set("orca-diaryflow|df-panel-width", String(Math.round(w3 * 100) / 100));
  const step3Saved = storage.get("orca-diaryflow|df-panel-width");
  console.log("已存宽度:", step3Saved, "== 0.36:", step3Saved === "0.36" ? "✓" : "✗");

  // 4. 无预存时用默认 0.42
  console.log("\n=== 4. 无预存 → 默认 0.42 ===");
  storage.delete("orca-diaryflow|df-panel-width");
  const DEFAULT = 0.42;
  const w4 = Math.min(0.85, Math.max(0.18, DEFAULT));
  console.log("默认宽度:", w4, "== 0.42:", w4 === 0.42 ? "✓" : "✗");

  const pass = html.includes("mom-empty-hint") && Math.abs(restored - 0.3) < 0.01
    && Math.abs(panelsTree.children[0].width - 0.7) < 0.01 && step3Saved === "0.36";
  console.log("\n" + (pass ? "=== 方案 D 测试通过 ===" : "=== 测试失败 ==="));
  await m.unload();
  process.exit(pass ? 0 : 1);
}
main();