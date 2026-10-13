import { mkdirSync, writeFileSync, existsSync, readdirSync, cpSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";

const SAMPLE_DIR = "samples";
mkdirSync("samples/bass", { recursive: true });
mkdirSync("samples/drums", { recursive: true });
mkdirSync("samples/piano", { recursive: true });

console.log("Downloading VSCO 2 CE (Contrabass)...");
try {
  execSync("rm -rf /tmp/VSCO-2-CE", { stdio: "ignore" });
  execSync("git clone --depth 1 https://github.com/sgossner/VSCO-2-CE.git /tmp/VSCO-2-CE", { stdio: "inherit" });
  
  const bassSrc = "/tmp/VSCO-2-CE/Strings/Contrabass";
  const { readdirSync, cpSync, existsSync } = await import("node:fs");
  if (existsSync(bassSrc)) {
    const files = readdirSync(bassSrc);
    let count = 0;
    files.forEach(f => {
      if (f.match(/Contrabass_(pizz|arco)_(ff|mf)_/) && f.endsWith(".wav")) {
        cpSync(`${bassSrc}/${f}`, `samples/bass/${f}`);
        console.log(`  Copied ${f}`);
      }
    });
  }
  execSync("rm -rf /tmp/VSCO-2-CE", { stdio: "ignore" });
  console.log("✓ VSCO 2 CE bass samples copied");
} catch (e) {
  console.error("Failed to download VSCO 2 CE:", e.message);
}

console.log("Downloading Virtuosity Drums...");
try {
  execSync("rm -rf /tmp/virtuosity_drums", { stdio: "ignore" });
  execSync("git clone --depth 1 https://github.com/sfzinstruments/virtuosity_drums.git /tmp/virtuosity_drums", { stdio: "inherit" });
  
  const drumsSrc = "/tmp/virtuosity_drums/Samples";
  if (existsSync(drumsSrc)) {
    const files = readdirSync(drumsSrc);
    files.forEach(f => {
      if (f.match(/(Kick|Snare|HiHat|Ride|Crash).*\.wav$/i)) {
        cpSync(`${drumsSrc}/${f}`, `samples/drums/${f}`);
        console.log(`  Copied ${f}`);
      }
    });
  }
  execSync("rm -rf /tmp/virtuosity_drums", { stdio: "ignore" });
  console.log("✓ Virtuosity drums copied");
} catch (e) {
  console.error("Failed to download Virtuosity drums:", e.message);
}

console.log("Downloading Salamander Grand Piano (CC BY 3.0)...");
try {
  execSync("rm -rf /tmp/VCSL", { stdio: "ignore" });
  execSync("git clone --depth 1 https://github.com/sgossner/VCSL.git /tmp/VCSL", { stdio: "inherit" });
  
  const pianoSrc = "/tmp/VCSL/SalamanderGrandPiano";
  if (existsSync(pianoSrc)) {
    const files = readdirSync(pianoSrc);
    let count = 0;
    files.forEach(f => {
      if (f.match(/SalamanderGrandPiano_.*\.wav$/i) && count < 60) {
        cpSync(`${pianoSrc}/${f}`, `samples/piano/${f}`);
        console.log(`  Copied ${f}`);
        count++;
      }
    });
    writeFileSync("samples/piano/ATTRIBUTION.md", 
      "Salamander Grand Piano by Alexander Holm\n" +
      "CC BY 3.0 - https://creativecommons.org/licenses/by/3.0/\n" +
      "Source: https://github.com/sgossner/VCSL\n" +
      "Sample pack: Salamander Grand Piano V3+"
    );
    console.log("✓ Salamander piano copied (" + count + " samples)");
  }
  execSync("rm -rf /tmp/VCSL", { stdio: "ignore" });
  console.log("✓ Salamander piano copied with attribution");
} catch (e) {
  console.error("Failed to download Salamander piano:", e.message);
}

console.log("\n✓ All samples downloaded to samples/");
