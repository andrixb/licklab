// Budget check (CI): fails on free-tier violations.
// Limits: 25 MiB per file, <18,000 files (margin under 20,000),
// initial JS payload budget documented in docs/deployment.md.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 18_000;
const INITIAL_JS_BUDGET_BYTES = 400 * 1024; // M0; tighten per milestone in docs/deployment.md

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
const js = files.filter((f) => f.path.endsWith(".js") && !f.path.includes("map"));
const initial = js.sort((a, b) => b.bytes - a.bytes).slice(0, 5);
const totalJs = initial.reduce((n, f) => n + f.bytes, 0);
console.log(`files=${files.length} top-js=${(totalJs / 1024).toFixed(0)}KB budget=${INITIAL_JS_BUDGET_BYTES / 1024}KB`);
if (totalJs > INITIAL_JS_BUDGET_BYTES) {
  console.error("OVER BUDGET: initial JS payload exceeds budget (see docs/deployment.md)");
  fail = true;
}
if (fail) process.exit(1);
console.log("budget OK");
