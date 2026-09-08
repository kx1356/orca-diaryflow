// 预置记录渲染 feed → 验证 .mom-filter-bar/.mom-pin-strip/.north-luna-moments-item/.mom-item 存在性及祖先链
import { JSDOM } from "jsdom";
import { pathToFileURL } from "node:url";

const distPath = "C:/Users/i5156/Documents/orca/plugins/orca-diaryflow/dist/index.js";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
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
globalThis.URL.createObjectURL = (b) => { const id = "blob:w" + ++urlSeq; urlStore.set(id, b); return id; };
globalThis.URL.revokeObjectURL = (u) => urlStore.delete(u);

const hooks = { layoutFns: [] };
globalThis.window.React = {
  useRef: (i) => ({ current: i }),
  useLayoutEffect: (fn) => { hooks.layoutFns.push(fn); },
  createElement: (t, p, ...c) => ({ type: t, props: p, children: c }),
};

// 预置一条带文字+图片的记录，让 feed 有实际内容
const pluginData = new Map([
  ["moments-records", JSON.stringify({
    config: { nickname: "月亮", signature: "言念君子，温其如玉", lockEnabled: false, lockPasscode: "", lockBg: "", cover: "" },
    items: [{ id: "r1", text: "有内容的测试记录，用来检查布局宽度是否占满面板。", images: [], created: "2026-09-08 12:00", comments: [], liked: false, pinned: false }],
  })],
]);

let panelComp = null;
globalThis.orca = {
  state: { dataDir: "C:/x", theme: "light", activePanel: "p1", panels: { children: [] }, headbarButtons: {} },
  notify: () => {},
  invokeBackend: async (method, ...args) => {
    if (method === "get-plugin-data") return pluginData.get(args[1]) ?? null;
    return null;
  },
  plugins: { getData: async (n, k) => pluginData.get(k) ?? null, setData: async () => {}, setSettingsSchema: async () => {} },
  commands: { registerCommand: () => {}, unregisterCommand: () => {} },
  headbar: { registerHeadbarButton: () => {}, unregisterHeadbarButton: () => {} },
  panels: { registerPanel: (t, c) => { panelComp = c; }, unregisterPanel: () => {} },
  components: { Button: "B" },
  nav: { addTo: () => "np", goTo: () => {}, switchFocusTo: () => {} },
};

const m = await import(pathToFileURL(distPath).href + "?_t=" + Date.now());
await m.load("orca-diaryflow");
await new Promise((r) => setTimeout(r, 150));

const container = document.createElement("div");
container.classList.add("orca-df-scope");
document.body.appendChild(container);
const vnode = panelComp({});
vnode.props.ref.current = container;
for (const fn of hooks.layoutFns.splice(0)) fn();
await new Promise((r) => setTimeout(r, 200));

function chain(el) {
  const a = [];
  let p = el;
  while (p && p !== document) { a.unshift(p.tagName.toLowerCase() + (p.classList.length ? "." + [...p.classList].join(".") : "")); p = p.parentElement; }
  return a.join(" > ");
}
for (const sel of [".mom-filter-bar", ".mom-pin-strip", ".north-luna-moments-item", ".mom-item", ".mom-search", ".mom-list .mom-item"]) {
  const el = container.querySelector(sel);
  console.log(sel, el ? "→ " + chain(el) : "→ (不存在)");
}
// 打印 mom-list 前 600 字符结构
const list = container.querySelector(".mom-list");
console.log("\n.mom-list innerHTML 前 700 字符:");
console.log(list ? list.innerHTML.slice(0, 700) : "n/a");
await m.unload();
process.exit(0);