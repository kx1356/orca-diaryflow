import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

// Load orca-blocks.js in a sandbox (it expects globalThis)
const src = readFileSync(new URL("../../src/orca-blocks.js", import.meta.url), "utf8");
const sandbox = { console, globalThis: {} };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src.replace(/^/, "var orca = { state: { blocks: {} }, invokeBackend: async () => null, plugins: {} };\n"), sandbox);
const B = sandbox.globalThis.__DF_ORCA_BLOCKS;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const fr = B.markdownLineToFragments("你好 **粗体** 和 *斜体* __下划__ ~~删~~ ==亮== `code` [链](https://a.com)");
assert(fr.some((x) => x.f === "b" && x.v === "粗体"), "bold");
assert(fr.some((x) => x.f === "i" && x.v === "斜体"), "italic");
assert(fr.some((x) => x.f === "u" && x.v === "下划" && x.fa && x.fa.us === "solid"), "underline");
assert(fr.some((x) => x.f === "s" && x.v === "删"), "strike");
assert(fr.some((x) => x.f === "bc" && x.fa && x.fa.bcc === "yellow"), "highlight");
assert(fr.some((x) => x.f === "c" && x.v === "code"), "code");
assert(fr.some((x) => x.t === "r" && x.u === "https://a.com"), "link");

const back = B.contentToMarkdown(fr);
assert(back.includes("**粗体**"), "roundtrip bold: " + back);
assert(back.includes("*斜体*"), "roundtrip italic");
assert(back.includes("__下划__"), "roundtrip underline");
assert(back.includes("~~删~~"), "roundtrip strike");
assert(back.includes("==亮=="), "roundtrip mark");
assert(back.includes("`code`"), "roundtrip code");
assert(back.includes("[链](https://a.com)"), "roundtrip link");

console.log("ok", fr.length, "frags →", back);
