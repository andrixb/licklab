// Budget check (CI): fails on free-tier violations.
// Limits: 25 MiB per file, <18,000 files (margin under 20,000),
// initial JS payload = entry chunk(s) referenced from dist/index.html.
// Lazy chunks (notation WASM, samples) are excluded from the initial budget
// but still subject to the 25 MiB per-file rule. Budgets documented in
// docs/deployment.md.
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 18_000;
const INITIAL_JS_BUDGET_BYTES = 400 * 1024; // M1; see docs/deployment.md

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else out.push({ path: p, bytes: st.size });
  }
  return out;
}

let files = [];
try {
  files = walk(DIST);
} catch {
  console.error("dist/ missing — run `npm run build` first");
  process.exit(1);
}

let fail = false;
for (const f of files) {
  if (f.bytes > MAX_FILE_BYTES) {
    console.error(`OVER BUDGET: ${f.path} ${(f.bytes / 1048576).toFixed(2)} MiB > 25 MiB`);
    fail = true;
  }
}
if (files.length > MAX_FILES) {
  console.error(`OVER BUDGET: ${files.length} files > ${MAX_FILES}`);
  fail = true;
}

// Initial payload: JS referenced directly from index.html (entry chunks).
const html = readFileSync(join(DIST, "index.html"), "utf8");
const refs = [...html.matchAll(/(?:src|href)="(\/?assets\/[^"]+\.(?:js|css))"/g)].map((m) => join(DIST, m[1].replace(/^\//, "")));
const initialBytes = refs.reduce((n, p) => {
  try {
    return n + statSync(p).size;
  } catch {
    console.error(`MISSING ENTRY ASSET: ${p}`);
    fail = true;
    return n;
  }
}, 0);
console.log(`files=${files.length} initial=${(initialBytes / 1024).toFixed(0)}KB budget=${INITIAL_JS_BUDGET_BYTES / 1024}KB`);
const lazy = files.filter((f) => f.path.endsWith(".js") && !refs.includes(f.path));
if (lazy.length > 0) {
  console.log(`lazy chunks (${lazy.length}): ${lazy.map((f) => `${f.path.split("/").pop()} ${(f.bytes / 1024).toFixed(0)}KB`).join(", ")}`);
}
if (initialBytes > INITIAL_JS_BUDGET_BYTES) {
  console.error("OVER BUDGET: initial JS payload exceeds budget (see docs/deployment.md)");
  fail = true;
}
if (fail) process.exit(1);
console.log("budget OK");
