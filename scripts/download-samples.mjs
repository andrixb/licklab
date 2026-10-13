import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

// URLs for sample packs (using GitHub release assets or raw content)
// VSCO 2 CE - Contrabass: https://github.com/sgossner/VSCO-2-CE
// Virtuosity Drums: https://github.com/sfzinstruments/virtuosity_drums
// Salamander Piano (CC BY 3.0): https://github.com/sgossner/VCSL

const SAMPLE_DIR = "samples";

mkdirSync(SAMPLE_DIR, { recursive: true });

// We'll use the release assets or clone shallow and extract needed files
// For now, let's create a manifest of what we need and download via gh CLI or curl

const samplesNeeded = {
  // VSCO 2 CE - Contrabass (CC0)
  // We need: a few velocity layers, pizzicato and arco
  vsco_bass: {
    repo: "sgossner/VSCO-2-CE",
    path: "Strings/Contrabass",
    files: [
      "Contrabass_pizz_ff_*.wav",
      "Contrabass_pizz_mf_*.wav",
      "Contrabass_arco_ff_*.wav",
      "Contrabass_arco_mf_*.wav",
    ],
    targetDir: "samples/bass",
  },
  // Virtuosity Drums (CC0) - basic jazz kit
  virtuosity_drums: {
    repo: "sfzinstruments/virtuosity_drums",
    path: "Samples",
    files: [
      "Kick_*.wav",
      "Snare_*.wav", 
      "HiHat_*.wav",
      "Ride_*.wav",
      "Crash_*.wav",
    ],
    targetDir: "samples/drums",
  },
  // Salamander Grand Piano (CC BY 3.0) - need attribution
  salamander_piano: {
    repo: "sgossner/VCSL",
    path: "SalamanderGrandPiano",
    files: [
      "SalamanderGrandPiano_*.wav",
    ],
    targetDir: "samples/piano",
    attribution: "Salamander Grand Piano by Alexander Holm, CC BY 3.0 (https://github.com/sgossner/VCSL)",
  },
};

console.log("Sample plan:", JSON.stringify(samplesNeeded, null, 2));

// Create directories
Object.values(samplesNeeded).forEach(s => {
  mkdirSync(s.targetDir, { recursive: true });
});

// For now, create a placeholder script that explains how to download
const instructions = `
# Sample Download Instructions

## VSCO 2 CE (Contrabass) - CC0
git clone --depth 1 --filter=blob:none --sparse https://github.com/sgossner/VSCO-2-CE.git
cd VSCO-2-CE
git sparse-checkout set "Strings/Contrabass"
# Copy needed files to samples/bass/

## Virtuosity Drums - CC0
git clone --depth 1 --filter=blob:none --sparse https://github.com/sfzinstruments/virtuosity_drums.git
cd virtuosity_drums
git sparse-checkout set "Samples"
# Copy needed files to samples/drums/

## Salamander Grand Piano - CC BY 3.0 (attribution required)
git clone --depth 1 --filter=blob:none --sparse https://github.com/sgossner/VCSL.git
cd VCSL
git sparse-checkout set "SalamanderGrandPiano"
# Copy needed files to samples/piano/
# ATTRIBUTION REQUIRED: "Salamander Grand Piano by Alexander Holm, CC BY 3.0"

# After downloading, run: npm run process-samples
`;

writeFileSync("samples/README.md", instructions);
console.log("Created samples/README.md with download instructions");
