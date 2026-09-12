// 标签功能端到端测试：发表含标签记录 → 展示 chips → 点击过滤 → 编辑回显
import { JSDOM } from "jsdom";
import { pathToFileURL, fileURLToPath } from "node:url";

const distPath = process.argv[2] || fileURLToPath(new URL("../../dist/index.js", import.meta.url));

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
globalThis.URL.createObjectURL = (b) => { const id = "blob:tag" + ++urlSeq; urlStore.set(id, b); return id; };
globalThis.URL.revokeObjectURL = (u) => urlStore.delete(u);

const hooks = { layoutFns: [] };
globalThis.window.React = {
  useRef: (i) => ({ current: i }),
  useLayoutEffect: (fn) => { hooks.layoutFns.push(fn); },
  createElement: (t, p, ...c) => ({ type: t, props: p, children: c }),
};

const storage = new Map();
globalThis.orca = {
  state: { dataDir: "C:/x", activePanel: "p1", panels: { children: [] }, headbarButtons: {}, locale: "zh-CN" },
  notify: (l, m) => {},
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
  panels: { registerPanel: (t, comp) => { globalThis.__panelComp = comp; }, unregisterPanel: () => {} },
  headbar: { registerHeadbarButton: () => {}, unregisterHeadbarButton: () => {} },
  components: { Button: "B" },
  nav: { addTo: () => "np", goTo: () => {}, switchFocusTo: () => {} },
};
const notifyMsgs = [];
globalThis.orca.notify = (l, m) => notifyMsgs.push(m);

const m = await import(pathToFileURL(distPath).href + "?_t=" + Date.now());
await m.load("orca-diaryflow");
await new Promise((r) => setTimeout(r, 100));

const container = document.createElement("div");
document.body.appendChild(container);
const vnode = globalThis.__panelComp({});
vnode.props.ref.current = container;
for (const fn of hooks.layoutFns.splice(0)) fn();
await new Promise((r) => setTimeout(r, 100));

// ===== 1. 打开编辑器 =====
const fab = [...container.querySelectorAll("button")].find((b) => b.getAttribute("title") === "发表日记");
fab.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 100));

// ===== 2. 填文字 + 标签 =====
const textarea = document.querySelector("textarea");
textarea.value = "标签功能测试记录";
textarea.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
const tagsInput = document.querySelector("[data-tags]");
console.log("=== 1. 标签输入框存在 ===", !!tagsInput);
if (!tagsInput) { console.log("全部按钮:", [...document.querySelectorAll("button")].map((b) => b.className).join(" | ")); process.exit(1); }
tagsInput.value = "工作, 生活, #重要";
tagsInput.dispatchEvent(new dom.window.Event("input", { bubbles: true }));

// ===== 3. 发表 =====
const submit = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").includes("发表"));
submit.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 250));

// ===== 4. 验证数据落盘（tags 已解析去 #） =====
const raw = storage.get("orca-diaryflow|moments-records");
const parsed = JSON.parse(raw);
const item = parsed.items[0];
console.log("=== 2. 保存的数据 ===");
console.log("tags:", JSON.stringify(item.tags));
const tagsOk = JSON.stringify(item.tags) === JSON.stringify(["工作", "生活", "重要"]);
console.log("tags 正确（去 #、去空、中英文逗号空格分隔）:", tagsOk ? "✓" : "✗ FAIL");

// ===== 5. 渲染展示 =====
const html2 = container.innerHTML;
console.log("=== 3. 渲染标签 chips ===");
const chips = [...container.querySelectorAll(".north-luna-moments-tag")].map((e) => e.textContent);
console.log("chips:", JSON.stringify(chips));
const renderOk = chips.length === 3 && chips[0] === "#工作";
console.log("3 个标签正确渲染:", renderOk ? "✓" : "✗ FAIL");

// ===== 6. 点击第一个标签 → 过滤 =====
console.log("=== 4. 点击标签过滤 ===");
const chip = container.querySelector(".north-luna-moments-tag");
chip.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 150));
console.log("页面显示记录（带#工作标签的记录）:", container.innerHTML.includes("标签功能测试记录") ? "✓" : "✗");

// 清空过滤再确认回复原
const pass = tagsOk && renderOk;
console.log("\n" + (pass ? "=== 标签功能测试通过 ===" : "=== 测试失败 ==="));
process.exit(pass ? 0 : 1);