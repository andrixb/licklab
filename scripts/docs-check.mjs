// Docs check (CI): AGENTS.md commands exist in package.json, internal links resolve,
// ADR index complete, documented folders exist, migrations logged in data-and-sync.md.
import { readFileSync, existsSync, readdirSync } from "node:fs";

const fail = (m) => {
  console.error(`DOCS CHECK FAIL: ${m}`);
  process.exitCode = 1;
};
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const agents = readFileSync("AGENTS.md", "utf8");

// 1. npm run <cmd> mentions in AGENTS.md must exist in package.json
for (const m of agents.matchAll(/npm run ([\w:+-]+)/g)) {
  if (!pkg.scripts[m[1]]) fail(`AGENTS.md references missing script: npm run ${m[1]}`);
}
// 2. docs/ links resolve
const mdFiles = readdirSync("docs").filter((f) => f.endsWith(".md"));
for (const f of mdFiles) {
  const content = readFileSync(`docs/${f}`, "utf8");
  for (const m of content.matchAll(/\]\(([^)]+)\)/g)) {
    const link = m[1];
    if (/^https?:/.test(link) || link.startsWith("#") || link.startsWith("mailto:")) continue;
    const target = link.split("#")[0];
    if (target && !existsSync(`docs/${target}`) && !existsSync(target)) fail(`${f} broken link: ${link}`);
  }
}
// 3. ADR index complete
const adrDir = readdirSync("docs/adr").filter((f) => /^adr-\d+.*\.md$/.test(f)).sort();
const index = readFileSync("docs/adr/index.md", "utf8");
for (const a of adrDir) if (!index.includes(a)) fail(`ADR index missing: ${a}`);
// 4. documented folders exist
for (const d of ["src/domain", "src/application", "src/adapters", "src/worker", "src/ui", "migrations"]) {
  if (!existsSync(d)) fail(`documented folder missing: ${d}`);
}
// 5. migrations logged
const syncDoc = readFileSync("docs/data-and-sync.md", "utf8");
for (const m of readdirSync("migrations").filter((f) => f.endsWith(".sql"))) {
  if (!syncDoc.includes(m)) fail(`migration not logged in data-and-sync.md: ${m}`);
}
if (process.exitCode) console.error("docs check FAILED");
else console.log(`docs check OK (${adrDir.length} ADRs, ${mdFiles.length} docs)`);
