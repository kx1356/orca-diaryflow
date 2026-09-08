// 端到端测试 v2：点击「发表日记」→ 填文字 → 发表 → 验证 PluginStorage 落盘 → 重启恢复
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
globalThis.URL.createObjectURL = (b) => { const id = "blob:test" + ++urlSeq; urlStore.set(id, b); return id; };
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
  notify: (l, msg) => console.log("[notify]", l, msg),
  invokeBackend: async (method, ...args) => {
    if (method === "get-plugin-data") return storage.get(args[0] + "|" + args[1]) ?? null;
    if (method === "list-plugin-files") return [];
    return null;
  },
  plugins: {
    getData: async (n, k) => storage.get(n + "|" + k) ?? null,
    setData: async (n, k, v) => {
      if (!["string", "number"].includes(typeof v) && !(v instanceof ArrayBuffer) && v !== null)
        throw new Error("Invalid value type");
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

const m = await import(pathToFileURL(distPath).href + "?_t=" + Date.now());
await m.load("orca-diaryflow");
await new Promise((r) => setTimeout(r, 100));

const container = document.createElement("div");
document.body.appendChild(container);
const vnode = globalThis.__panelComp({});
vnode.props.ref.current = container;
for (const fn of hooks.layoutFns.splice(0)) fn();
await new Promise((r) => setTimeout(r, 100));

// 1. 点击「发表日记」浮动按钮
const fabBtn = [...container.querySelectorAll("button")].find((b) => b.getAttribute("title") === "发表日记");
console.log("=== 1. 点击 发表日记 按钮 ===", !!fabBtn);
fabBtn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 100));

// 2. 编辑器应出现（body 或 container 里的 textarea）
const textarea = document.querySelector("textarea") || container.querySelector("textarea");
console.log("=== 2. 编辑器 textarea 出现 ===", !!textarea);
if (!textarea) {
  // 也许编辑器是 contenteditable
  const ce = document.querySelector("[contenteditable]") || container.querySelector("[contenteditable]");
  console.log("contenteditable:", !!ce);
  console.log("body 尾部 HTML:", document.body.innerHTML.slice(-500));
  process.exit(1);
}

// 3. 填入文字
textarea.value = "端到端测试：这条记录必须落盘";
textarea.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
await new Promise((r) => setTimeout(r, 50));

// 4. 找发表/提交按钮
let submitBtn = null;
for (const b of document.querySelectorAll("button")) {
  const t = (b.textContent || "") + (b.getAttribute("title") || "") + (b.getAttribute("data-act") || "");
  if (/发表|发布|提交|确定|保存/.test(t)) submitBtn = b;
}
console.log("=== 3. 提交按钮 ===", submitBtn ? (submitBtn.textContent || submitBtn.getAttribute("title")) : "NOT FOUND");
if (submitBtn) {
  submitBtn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 200));
}

// 5. 验证 PluginStorage
const raw = storage.get("orca-diaryflow|moments-records");
console.log("\n=== 4. PluginStorage 落盘验证 ===");
console.log("moments-records 已写入:", raw != null);
if (raw) {
  const parsed = JSON.parse(raw);
  console.log("记录数:", parsed.items.length);
  console.log("记录文本:", JSON.stringify(parsed.items.map((i) => i.text)));
  const ok = parsed.items.some((i) => i.text === "端到端测试：这条记录必须落盘");
  console.log(ok ? "\n=== 端到端测试通过：发表→落盘 OK ===" : "\n=== 失败：未找到提交的文本 ===");
  process.exit(ok ? 0 : 1);
} else {
  console.log("=== 失败：moments-records 未写入 ===");
  console.log("storage keys:", [...storage.keys()]);
  process.exit(1);
}
