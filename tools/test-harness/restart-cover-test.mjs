// 重启场景测试：预置 db 数据 + 磁盘文件 → load() → 封面应解析为 blob URL 并渲染
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
globalThis.URL.createObjectURL = (b) => { const id = "blob:restart" + ++urlSeq; urlStore.set(id, b); return id; };
globalThis.URL.revokeObjectURL = (u) => urlStore.delete(u);

const hooks = { layoutFns: [] };
globalThis.window.React = {
  useRef: (i) => ({ current: i }),
  useLayoutEffect: (fn) => { hooks.layoutFns.push(fn); },
  createElement: (t, p, ...c) => ({ type: t, props: p, children: c }),
};

// ===== 模拟真实持久层（与用户 db 中实际数据一致） =====
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8]);
const pluginFiles = new Map([["media/df_mts1nw6f_jgkzbh.png", PNG_BYTES.buffer.slice(0)]]); // 磁盘文件
const pluginData = new Map([
  ["moments-records", JSON.stringify({
    config: { nickname: "月亮", signature: "言念君子，温其如玉", lockEnabled: false, lockPasscode: "", lockBg: "", cover: "dfasset://media/df_mts1nw6f_jgkzbh.png" },
    items: [{ id: "r1", text: "重启后封面恢复测试", images: ["dfasset://media/df_mts1nw6f_jgkzbh.png"], created: "2026-09-08 12:00", comments: [], liked: false, pinned: false }],
  })],
  ["media-index", JSON.stringify(["df_mts1nw6f_jgkzbh.png"])],
]);

// 严格模拟真实后端：get-plugin-file 的 type 只认 "string"|"buffer"，其他返回 null（这就是本次 bug）
let readFileCalls = [];
globalThis.orca = {
  state: { dataDir: "C:/x", activePanel: "p1", panels: { children: [] }, headbarButtons: {}, locale: "zh-CN" },
  notify: (l, m) => console.log("[notify]", l, m),
  invokeBackend: async (method, ...args) => {
    if (method === "get-plugin-data") return pluginData.get(args[1]) ?? null;
    if (method === "set-plugin-data") { pluginData.set(args[1], args[2]); return true; }
    if (method === "get-plugin-file") {
      // invokeBackend("get-plugin-file", name, rel, type): args[0]=name args[1]=rel args[2]=type
      readFileCalls.push([args[1], args[2]]);
      const bytes = pluginFiles.get(args[1]);
      if (bytes == null) return null;
      if (args[2] === "buffer") return bytes;                      // 官方支持的类型 → ArrayBuffer
      if (args[2] === "string") return "binary-string";            // 官方支持的类型 → string
      return null;                                                 // "base64" 等非法类型 → null（bug 现象）
    }
    if (method === "list-plugin-files") return ["media"];
    return null;
  },
  plugins: {
    getData: async (n, k) => pluginData.get(k) ?? null,
    setData: async (n, k, v) => {
      if (!["string", "number"].includes(typeof v) && !(v instanceof ArrayBuffer) && v !== null) throw new Error("Invalid value type");
      pluginData.set(k, v);
    },
    setSettingsSchema: async () => {},
  },
  commands: { registerCommand: () => {}, unregisterCommand: () => {} },
  panels: { registerPanel: (t, comp) => { globalThis.__panelComp = comp; }, unregisterPanel: () => {} },
  headbar: { registerHeadbarButton: () => {}, unregisterHeadbarButton: () => {} },
  components: { Button: "B" },
  nav: { addTo: () => "np", goTo: () => {}, switchFocusTo: () => {} },
};

// ===== 模拟重启：冷加载 =====
const m = await import(pathToFileURL(distPath).href + "?_t=" + Date.now());
await m.load("orca-diaryflow");
await new Promise((r) => setTimeout(r, 200));

const container = document.createElement("div");
document.body.appendChild(container);
const vnode = globalThis.__panelComp({});
vnode.props.ref.current = container;
for (const fn of hooks.layoutFns.splice(0)) fn();
await new Promise((r) => setTimeout(r, 200));

const html = container.innerHTML;
console.log("=== 1. readFile 调用类型检查 ===");
console.log("调用记录:", JSON.stringify(readFileCalls));
const usedBuffer = readFileCalls.length > 0 && readFileCalls.every(([, t]) => t === "buffer");
console.log("全部使用官方 buffer 类型:", usedBuffer ? "✓" : "✗ FAIL");

console.log("\n=== 2. 封面渲染检查 ===");
const A = globalThis.__DF_ASSETS;
const coverRef = "dfasset://media/df_mts1nw6f_jgkzbh.png";
const resolved = A.resolve(coverRef);
console.log("resolve(cover) =", resolved.slice(0, 40));
console.log("是 blob URL（非占位图）:", resolved.startsWith("blob:") ? "✓" : "✗ FAIL — " + resolved.slice(0, 60));
console.log("HTML 含 blob 封面:", html.includes("blob:restart") ? "✓" : "✗ FAIL");
const coverImgMatch = html.match(/mom-cover-img[^>]*src="([^"]+)"/);
console.log("封面 img src:", coverImgMatch ? coverImgMatch[1].slice(0, 40) : "(无)");
console.log("记录文本渲染:", html.includes("重启后封面恢复测试") ? "✓" : "✗");

console.log("\n=== 3. 占位图泄漏检查 ===");
const GIF = "data:image/gif;base64,R0lGODlh";
console.log("封面用了占位图:", html.includes(GIF) ? "✗ FAIL（仍在用占位图）" : "✓ 无占位图");

const pass = usedBuffer && resolved.startsWith("blob:") && html.includes("blob:restart") && !html.includes(GIF);
console.log("\n" + (pass ? "=== 重启封面恢复测试通过 ===" : "=== 测试失败 ==="));
process.exit(pass ? 0 : 1);
