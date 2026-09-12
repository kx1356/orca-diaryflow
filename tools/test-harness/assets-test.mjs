// DF_ASSETS 图片存储层完整链路测试
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
// Node 的 URL.createObjectURL 不认 jsdom Blob —— 包装为通用实现
const urlStore = new Map();
let urlSeq = 0;
globalThis.URL.createObjectURL = (blobLike) => {
  const id = "blob:nodedie" + ++urlSeq;
  urlStore.set(id, blobLike);
  return id;
};
globalThis.URL.revokeObjectURL = (u) => { urlStore.delete(u); };

globalThis.window.React = {
  useRef: (i) => ({ current: i }),
  useLayoutEffect: () => {},
  createElement: (t, p, ...c) => ({ type: t, props: p, children: c }),
};

const pluginFiles = new Map();
const setFileCalls = [];
globalThis.orca = {
  state: { dataDir: "C:/x", activePanel: "p1", panels: { children: [] }, headbarButtons: {}, locale: "zh-CN" },
  notify: () => {},
  invokeBackend: async (method, ...args) => {
    if (method === "get-plugin-data") return null;
    if (method === "set-plugin-file") { setFileCalls.push([args[1], typeof args[2], args[3]]); pluginFiles.set(args[1], args[2]); return true; }
    if (method === "get-plugin-file") return pluginFiles.get(args[1]) ?? null;
    if (method === "list-plugin-files") {
      const prefix = args[1] ? args[1] + "/" : "";
      return [...pluginFiles.keys()].filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
    }
    return null;
  },
  plugins: { getData: async () => null, setData: async () => {}, setSettingsSchema: async () => {} },
  commands: { registerCommand: () => {}, unregisterCommand: () => {} },
  panels: { registerPanel: () => {}, unregisterPanel: () => {} },
  headbar: { registerHeadbarButton: () => {}, unregisterHeadbarButton: () => {} },
  components: { Button: "B" },
  nav: { addTo: () => "np", goTo: () => {}, switchFocusTo: () => {} },
};

async function main() {
  await mod_load();
  const A = globalThis.__DF_ASSETS;
  console.log("=== DF_ASSETS 存在:", !!A);

  // 1. save：模拟上传一张 png
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5]);
  const fakeFile = new Blob([pngBytes], { type: "image/png" });
  fakeFile.name = "test.png";
  fakeFile.arrayBuffer = async () => pngBytes.buffer;
  const ref = await A.save(fakeFile, "df_test123.png");
  console.log("save 返回 ref:", ref);
  console.log("set-plugin-file 调用:", JSON.stringify(setFileCalls));
  console.log("断言 ref 正确:", ref === "dfasset://media/df_test123.png");

  // 2. resolve：未加载时 → 占位图；load 后 → blob URL
  const before = A.resolve(ref);
  console.log("resolve(未load):", before.slice(0, 40), before.startsWith("data:image/gif") ? "(占位符 OK)" : "(FAIL)");
  A.map.delete(ref); // 清掉 save 时缓存的，测 load 路径
  const url = await A.load(ref);
  console.log("load 返回 url:", url ? url.slice(0, 30) + "..." : "(FAIL)");
  console.log("是 blob URL:", String(url).startsWith("blob:"));
  const after = A.resolve(ref);
  console.log("resolve(load后) === load url:", after === url);

  // 3. listMedia
  const list = await A.listMedia();
  console.log("listMedia:", JSON.stringify(list));

  // 4. toDataUrl（导出用）
  const dataUrl = await A.toDataUrl(ref);
  console.log("toDataUrl 前缀:", dataUrl.slice(0, 30), dataUrl.startsWith("data:image/png;base64,") ? "(OK)" : "(FAIL)");

  // 5. hydrate：模拟含图记录
  const data = { config: { avatar: ref }, items: [{ images: [ref] }] };
  await A.hydrate(data);
  console.log("hydrate 后 resolve 可用:", A.resolve(ref).startsWith("blob:"));

  console.log("\n=== ASSETS TEST DONE ===");
  process.exit(0);
}

async function mod_load() {
  const mod = await import(pathToFileURL(distPath).href + "?_t=" + Date.now());
  await mod.load("orca-diaryflow");
  await new Promise((r) => setTimeout(r, 100));
}
main();
