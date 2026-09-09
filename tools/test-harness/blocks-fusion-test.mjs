// 深融合块层冒烟：mock orca API
import { pathToFileURL } from "node:url";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const src = readFileSync(join(ROOT, "src", "orca-blocks.js"), "utf8");

const store = new Map();
const blocks = new Map();
let nextId = 100;

globalThis.orcaPluginName = "orca-diaryflow";
const editorApi = {
  invokeGroup: async (fn) => { await fn(); },
  invokeCommand: async (cmd, _c, a, b, c, d) => {
    return globalThis.orca.commands.invokeEditorCommand(cmd, _c, a, b, c, d);
  },
};
globalThis.orca = {
  state: {
    blocks: {},
    activePanel: "p1",
    repoDir: "C:/tmp/orca-repo",
    dataDir: "C:/tmp/orca-data",
    repo: "test",
    platform: "win32",
    panels: { id: "root", children: [{ id: "p1", view: "journal", viewState: { editor: editorApi }, viewArgs: {} }] },
  },
  utils: {
    getAssetPath: (p) => p,
  },
  plugins: {
    getData: async (_n, k) => store.get(k) ?? null,
    setData: async (_n, k, v) => { store.set(k, v); },
  },
  invokeBackend: async (method, ...args) => {
    if (method === "get-journal-block") {
      const id = 1;
      const b = { id, text: "Journal", children: [], refs: [], properties: [], created: args[0] || new Date() };
      blocks.set(id, b);
      orca.state.blocks[id] = b;
      return b;
    }
    if (method === "get-block") return blocks.get(args[0]) || orca.state.blocks[args[0]] || null;
    if (method === "get-blocks") return args[0].map((id) => blocks.get(id) || orca.state.blocks[id]).filter(Boolean);
    if (method === "get-blocks-with-tags") {
      const tag = args[0][0];
      return [...blocks.values()].filter((b) => (b.refs || []).some((r) => r.type === 2 && r.alias === tag));
    }
    if (method === "search-blocks-by-text") {
      const kw = String(args[0] || "").toLowerCase();
      return [[...blocks.values()].filter((b) => String(b.text || "").toLowerCase().includes(kw)), []];
    }
    if (method === "upload-asset-binary") {
      return "./assets/mock-" + Date.now() + ".jpg";
    }
    return null;
  },
  commands: {
    invokeGroup: async (fn) => { await fn(); },
    invokeEditorCommand: async (cmd, _c, a, b, c, d) => {
      if (cmd === "core.editor.insertBlock") {
        const id = ++nextId;
        const pos = typeof b === "string" ? b : "lastChild";
        const content = Array.isArray(b) ? b : c;
        const opts = Array.isArray(b) ? c : d;
        const text = (content || []).map((x) => x && x.v).filter(Boolean).join("") || "";
        const repr = opts && typeof opts === "object" ? opts : { type: "text" };
        let parentId = a && a.id;
        if (pos === "after" && a && a.parent) parentId = a.parent;
        const block = {
          id, text, children: [], refs: [], properties: [], created: new Date(),
          parent: parentId, _repr: repr, repr
        };
        blocks.set(id, block);
        orca.state.blocks[id] = block;
        const parent = parentId && orca.state.blocks[parentId];
        if (parent) {
          parent.children = parent.children || [];
          if (pos === "after" && a && a.id) {
            const idx = parent.children.indexOf(a.id);
            if (idx >= 0) parent.children.splice(idx + 1, 0, id);
            else parent.children.push(id);
          } else {
            parent.children.push(id);
          }
        }
        return id;
      }
      if (cmd === "core.editor.setBlocksContent") {
        const list = a || [];
        list.forEach((row) => {
          const bl = blocks.get(row.id) || orca.state.blocks[row.id];
          if (bl) {
            bl.text = (row.content || []).map((x) => x && x.v).filter(Boolean).join("") || "";
            bl.content = row.content;
          }
        });
        return true;
      }
      if (cmd === "core.editor.insertTag") {
        const id = a;
        const alias = b;
        const bl = blocks.get(id) || orca.state.blocks[id];
        if (bl) {
          bl.refs = bl.refs || [];
          bl.refs.push({ id: ++nextId, from: id, to: id, type: 2, alias });
        }
        return true;
      }
      if (cmd === "core.editor.deleteBlocks") {
        (a || []).forEach((id) => {
          const bl = blocks.get(id) || orca.state.blocks[id];
          if (bl && bl.parent && orca.state.blocks[bl.parent]) {
            const ch = orca.state.blocks[bl.parent].children || [];
            orca.state.blocks[bl.parent].children = ch.filter((x) => x !== id);
          }
          blocks.delete(id);
          delete orca.state.blocks[id];
        });
        return true;
      }
      return null;
    },
  },
  nav: {
    goTo: () => {},
    openInLastPanel: () => {},
    switchFocusTo: (id) => { orca.state.activePanel = id; },
    findViewPanel: (id, root) => {
      if (root && root.id === id) return root;
      if (root && Array.isArray(root.children)) {
        for (const c of root.children) {
          if (c.id === id) return c;
          const r = orca.nav.findViewPanel(id, c);
          if (r) return r;
        }
      }
      return null;
    },
  },
};

// eval blocks source in this scope
const tmp = join(ROOT, "tools", "test-harness", "_blocks-eval.cjs");
writeFileSync(tmp, src + "\nmodule.exports = globalThis.__DF_ORCA_BLOCKS;\n");
const OB = (await import(pathToFileURL(tmp).href + "?t=" + Date.now())).default;

const created = await OB.createEntry({
  text: "hello fusion #日记流,#工作",
  tags: ["工作"],
  images: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="]
});
console.log("createEntry id:", created.id);
console.log("createEntry text cleaned:", created.text);

const feed1 = await OB.listFeed({});
console.log("listFeed count:", feed1.items.length, "tags:", feed1.items[0] && feed1.items[0].tags, "text:", feed1.items[0] && feed1.items[0].text, "images:", feed1.items[0] && feed1.items[0].images && feed1.items[0].images.length);

const stripOk = OB.stripInlineTagText("123 #日记流,#人物", ["人物"]) === "123";
console.log("strip inline tags:", stripOk);

const feed2 = await OB.listFeed({ kw: "hello" });
console.log("search hello:", feed2.items.length);

const feed3 = await OB.listFeed({ tags: ["工作"] });
console.log("filter tag 工作:", feed3.items.length);

await OB.deleteEntry(created.id);
const feed4 = await OB.listFeed({});
console.log("after delete:", feed4.items.length);

const ok = feed1.items.length === 1 && feed2.items.length === 1 && feed3.items.length === 1 && feed4.items.length === 0
  && feed1.items[0].tags.includes("工作")
  && !/#日记流|#工作/.test(feed1.items[0].text || "")
  && stripOk
  && (feed1.items[0].images || []).length >= 1;
console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
