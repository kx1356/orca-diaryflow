// 运行时测试 v2：完整测试 load() + 面板渲染 + 发表流程
import { JSDOM } from "jsdom";
import { pathToFileURL } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const distPath = process.argv[2] || fileURLToPath(new URL("../../dist/index.js", import.meta.url));

// ---------- jsdom 环境 ----------
const dom = new JSDOM("<!DOCTYPE html><html><head></head><body><div id='app'></div></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.MutationObserver = dom.window.MutationObserver;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.Blob = dom.window.Blob;
globalThis.atob = (s) => Buffer.from(s, "base64").toString("binary");
globalThis.btoa = (s) => Buffer.from(s, "binary").toString("base64");
if (!globalThis.matchMedia) globalThis.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });

// ---------- React mock（捕获 useLayoutEffect 回调以触发挂载） ----------
const hooks = { layoutFns: [], effectFns: [] };
globalThis.window.React = {
  useRef: (init) => ({ current: init }),
  useLayoutEffect: (fn) => { hooks.layoutFns.push(fn); },
  useEffect: (fn) => { hooks.effectFns.push(fn); },
  createElement: (type, props, ...children) => ({ type, props, children }),
};

// ---------- orca mock ----------
const calls = { registerPanel: [], registerHeadbar: [], registerCommand: [], notify: [] };
let panelComp = null;
const pluginFiles = new Map();
const pluginData = new Map();
const panelsTree = { id: "root", children: [{ id: "p1", view: "editor" }] };

globalThis.orca = {
  state: {
    dataDir: process.cwd(),
    activePanel: "p1",
    panels: panelsTree,
    headbarButtons: {},
    theme: "light",
    locale: "zh-CN",
  },
  notify: (level, msg, opts) => { calls.notify.push([level, msg]); console.log("[notify]", level, msg); },
  invokeBackend: async (method, ...args) => {
    if (method === "get-plugin-data") return pluginData.get(args[1]) ?? null;
    if (method === "get-plugin-file") return pluginFiles.get(args[1]) ?? null;
    if (method === "list-plugin-files") {
      const prefix = args[1] ? args[1] + "/" : "";
      return [...pluginFiles.keys()].filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
    }
    return null;
  },
  plugins: {
    getData: async (n, key) => pluginData.get(key) ?? null,
    setData: async (n, key, val) => { pluginData.set(key, val); },
    setSettingsSchema: async () => {},
  },
  commands: {
    registerCommand: (id) => calls.registerCommand.push(id),
    unregisterCommand: () => {},
  },
  panels: {
    registerPanel: (type, comp) => { panelComp = comp; calls.registerPanel.push(type); },
    unregisterPanel: () => {},
  },
  headbar: {
    registerHeadbarButton: (id) => calls.registerHeadbar.push(id),
    unregisterHeadbarButton: () => {},
  },
  components: { Button: "ButtonComponent" },
  nav: {
    addTo: (id, dir, opts) => { const nid = "np1"; panelsTree.children.push({ id: nid, view: opts.view }); return nid; },
    goTo: () => {},
    switchFocusTo: () => {},
    findViewPanel: () => null,
  },
};

// ---------- 测试 ----------
async function main() {
  console.log("=== 1. import ===");
  const url = pathToFileURL(distPath).href + "?_t=" + Date.now();
  let mod;
  try {
    mod = await import(url);
    console.log("OK, exports:", Object.keys(mod).join(", "));
  } catch (e) {
    console.error("IMPORT FAILED:", e);
    process.exit(1);
  }

  console.log("\n=== 2. load ===");
  try {
    await mod.load("orca-diaryflow");
    console.log("OK");
  } catch (e) {
    console.error("LOAD THREW:", e);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 150));

  console.log("\n=== 3. 注册验证 ===");
  console.log("panel:", calls.registerPanel.join(",") || "(none)");
  console.log("headbar:", calls.registerHeadbar.join(",") || "(none)");
  console.log("command:", calls.registerCommand.join(",") || "(none)");
  console.log("notify:", calls.notify.length ? JSON.stringify(calls.notify) : "(none)");
  if (calls.notify.some((n) => n[0] === "error")) { console.error("HAS ERROR NOTIFY — FAIL"); process.exit(1); }

  console.log("\n=== 4. 面板渲染 ===");
  if (!panelComp) { console.error("no panel component captured"); process.exit(1); }
  // 调用面板组件（触发 useRef + useLayoutEffect）
  let vnode;
  try {
    vnode = panelComp({});
    console.log("panel comp returned vnode type:", vnode && vnode.type);
  } catch (e) {
    console.error("PANEL RENDER THREW:", e);
    process.exit(1);
  }
  // 执行 useLayoutEffect 回调 → orcaMount(ref.current)
  // vnode.props.ref 是 useRef 返回的对象 {current:null}，orcaMount 会用到 ref.current —— 需要一个真实容器
  const container = document.createElement("div");
  document.body.appendChild(container);
  const refObj = vnode.props.ref;
  refObj.current = container;
  try {
    for (const fn of hooks.layoutFns) fn();
    hooks.layoutFns.length = 0;
    // cleanup 函数不调用
  } catch (e) {
    console.error("MOUNT THREW:", e);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 100));
  const html = container.innerHTML;
  console.log("container innerHTML length:", html.length);
  console.log("has mom-root:", html.includes("mom-root"));
  console.log("has cover:", html.includes("mom-cover") || html.includes("cover"));
  console.log("has empty state:", html.includes("mom-empty") || html.includes("空"));
  if (html.length < 500) {
    console.error("RENDER TOO SMALL — likely failed");
    console.error(html.slice(0, 400));
    process.exit(1);
  }

  console.log("\n=== 5. 发表一条记录（模拟） ===");
  // 直接操作 pluginData（storage 层）：写入一条含图片引用的记录，重新渲染
  pluginData.set("moments-records", {
    config: { nickname: "测试", signature: "言念君子，温其如玉", lockEnabled: false, lockPasscode: "", lockBg: "", avatar: "", cover: "" },
    items: [{ id: "t1", text: "第一条测试记录", images: [], created: "2026-09-08T09:00", comments: [], likes: 0, pinned: false }],
  });
  // 通过再次调用 layout effect 不行（只挂载一次）。改用 window.OrcaDiaryflowPlugin 重新 load 到新容器
  const container2 = document.createElement("div");
  document.body.appendChild(container2);
  hooks.layoutFns.length = 0;
  const vnode2 = panelComp({});
  vnode2.props.ref.current = container2;
  try { for (const fn of hooks.layoutFns) fn(); } catch (e) { console.error("REMOUNT THREW:", e); process.exit(1); }
  await new Promise((r) => setTimeout(r, 100));
  const html2 = container2.innerHTML;
  console.log("remount innerHTML length:", html2.length);
  console.log("shows test record:", html2.includes("第一条测试记录"));

  console.log("\n=== 6. unload ===");
  try {
    await mod.unload();
    console.log("OK");
  } catch (e) {
    console.error("UNLOAD THREW:", e);
  }

  console.log("\n=== ALL TESTS DONE ===");
  process.exit(0);
}
main();
