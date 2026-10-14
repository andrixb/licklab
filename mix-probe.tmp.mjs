// Mix probe: capture full band, report clipping + harshness metrics.
// Run:  npm run dev  (in another shell)
//       node /Users/Andrix/Projects/licklab/mix-probe.tmp.mjs
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const URL = "http://localhost:5173/play?c=Dm7%20G7%20%7C%20Cmaj7%20%7C";
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0].slice(0, 160)}`));
await page.goto(URL, { waitUntil: "networkidle" });
await page.getByRole("region", { name: "progression workspace" }).waitFor({ timeout: 15000 });
await page.getByRole("button", { name: "▶ Play chorus" }).click();
await page.waitForFunction(() => !!window.__licklabAudio, null, { timeout: 60000 });
await page.getByRole("button", { name: "■ Stop" }).click().catch(() => {});
await page.evaluate(() => {
  const hook = window.__licklabAudio;
  const ctx = hook.tone.getContext().rawContext;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 8192;
  hook.tone.getDestination().connect(analyser);
  const buf = new Float32Array(8192);
  window.__tap = { analyser, chunks: [], sr: ctx.sampleRate };
  window.__poller = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    window.__tap.chunks.push(Array.from(buf));
  }, 120);
});
await page.getByRole("button", { name: "▶ Play chorus" }).click();
await page.waitForTimeout(9000);
const out = await page.evaluate(() => {
  clearInterval(window.__poller);
  return { sr: window.__tap.sr, samples: window.__tap.chunks.flat() };
});
await browser.close();
writeFileSync("/tmp/mix.json", JSON.stringify({ sr: out.sr, samples: out.samples }));
console.log(`captured ${out.samples.length} @${out.sr}Hz; errors:`, errors.length ? errors.slice(0, 5) : "(none)");
