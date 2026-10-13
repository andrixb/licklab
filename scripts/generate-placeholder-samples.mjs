import { mkdirSync, writeFileSync } from "node:fs";

function generateWav(frequency, durationMs, sampleRate = 44100) {
  const numSamples = Math.floor(sampleRate * durationMs / 1000);
  const data = new Int16Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    data[i] = Math.max(-32768, Math.min(32767, Math.round(Math.sin(2 * Math.PI * frequency * t) * 16384)));
  }
  
  const header = Buffer.alloc(44);
  let offset = 0;
  header.write("RIFF", offset); offset += 4;
  header.writeUInt32LE(36 + data.length * 2, offset); offset += 4;
  header.write("WAVE", offset); offset += 4;
  header.write("fmt ", offset); offset += 4;
  header.writeUInt32LE(16, offset); offset += 4;
  header.writeUInt16LE(1, offset); offset += 2;
  header.writeUInt16LE(1, offset); offset += 2;
  header.writeUInt32LE(44100, offset); offset += 4;
  header.writeUInt32LE(44100 * 2, offset); offset += 4;
  header.writeUInt16LE(2, offset); offset += 2;
  header.writeUInt16LE(16, offset); offset += 2;
  header.write("data", offset); offset += 4;
  header.writeUInt32LE(data.length * 2, offset); offset += 4;
  
  const audioData = Buffer.from(data.buffer);
  return Buffer.concat([header, audioData]);
}

import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync("samples/bass", { recursive: true });
mkdirSync("samples/drums", { recursive: true });
mkdirSync("samples/piano", { recursive: true });

function generateWav(frequency, durationMs, sampleRate = 44100) {
  const numSamples = Math.floor(sampleRate * durationMs / 1000);
  const data = new Int16Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    data[i] = Math.max(-32768, Math.min(32767, Math.round(Math.sin(2 * Math.PI * frequency * t) * 16384)));
  }
  
  const header = Buffer.alloc(44);
  let offset = 0;
  header.write("RIFF", offset); offset += 4;
  header.writeUInt32LE(36 + data.length * 2, offset); offset += 4;
  header.write("WAVE", offset); offset += 4;
  header.write("fmt ", offset); offset += 4;
  header.writeUInt32LE(16, offset); offset += 4;
  header.writeUInt16LE(1, offset); offset += 2;
  header.writeUInt16LE(1, offset); offset += 2;
  header.writeUInt32LE(44100, offset); offset += 4;
  header.writeUInt32LE(44100 * 2, offset); offset += 4;
  header.writeUInt16LE(2, offset); offset += 2;
  header.writeUInt16LE(16, offset); offset += 2;
  header.write("data", offset); offset += 4;
  header.writeUInt32LE(data.length * 2, offset); offset += 4;
  
  const audioData = Buffer.from(data.buffer);
  return Buffer.concat([header, audioData]);
}

mkdirSync("samples/bass", { recursive: true });
mkdirSync("samples/drums", { recursive: true });
mkdirSync("samples/piano", { recursive: true });

const bassNotes = [
  { name: "Contrabass_pizz_mf_C2", freq: 65.41 },
  { name: "Contrabass_pizz_mf_E2", freq: 82.41 },
  { name: "Contrabass_pizz_mf_G2", freq: 98.00 },
  { name: "Contrabass_pizz_mf_C3", freq: 130.81 },
];

bassNotes.forEach(n => {
  const wav = generateWav(n.freq, 500);
  writeFileSync(`samples/bass/${n.name}.wav`, wav);
  console.log(`Generated samples/bass/${n.name}.wav`);
});

const drumSamples = [
  { name: "Kick", freq: 60, dur: 100 },
  { name: "Snare", freq: 200, dur: 150 },
  { name: "HiHat", freq: 800, dur: 50 },
  { name: "Ride", freq: 600, dur: 300 },
  { name: "Crash", freq: 1000, dur: 500 },
];

drumSamples.forEach(d => {
  const wav = generateWav(d.freq, d.dur);
  writeFileSync(`samples/drums/${d.name}.wav`, wav);
  console.log(`Generated samples/drums/${d.name}.wav`);
});

const pianoNotes = [
  { name: "SalamanderGrandPiano_C3", freq: 130.81 },
  { name: "SalamanderGrandPiano_D3", freq: 146.83 },
  { name: "SalamanderGrandPiano_E3", freq: 164.81 },
  { name: "SalamanderGrandPiano_F3", freq: 174.61 },
  { name: "SalamanderGrandPiano_G3", freq: 196.00 },
  { name: "SalamanderGrandPiano_A3", freq: 220.00 },
  { name: "SalamanderGrandPiano_B3", freq: 246.94 },
  { name: "SalamanderGrandPiano_C4", freq: 261.63 },
  { name: "SalamanderGrandPiano_D4", freq: 293.66 },
  { name: "SalamanderGrandPiano_E4", freq: 329.63 },
  { name: "SalamanderGrandPiano_F4", freq: 349.23 },
  { name: "SalamanderGrandPiano_G4", freq: 392.00 },
  { name: "SalamanderGrandPiano_A4", freq: 440.00 },
  { name: "SalamanderGrandPiano_B4", freq: 493.88 },
  { name: "SalamanderGrandPiano_C5", freq: 523.25 },
];

pianoNotes.forEach(n => {
  const wav = generateWav(n.freq, 1000);
  writeFileSync(`samples/piano/${n.name}.wav`, wav);
  console.log(`Generated samples/piano/${n.name}.wav`);
});

const drumSamples = [
  { name: "Kick", freq: 60, dur: 100 },
  { name: "Snare", freq: 200, dur: 150 },
  { name: "HiHat", freq: 800, dur: 50 },
  { name: "Ride", freq: 600, dur: 300 },
  { name: "Crash", freq: 1000, dur: 500 },
];

drumSamples.forEach(d => {
  const wav = generateWav(d.freq, d.dur);
  writeFileSync(`samples/drums/${d.name}.wav`, wav);
  console.log(`Generated samples/drums/${d.name}.wav`);
});

pianoNotes.forEach(n => {
  const wav = generateWav(n.freq, 1000);
  writeFileSync(`samples/piano/${n.name}.wav`, wav);
  console.log(`Generated samples/piano/${n.name}.wav`);
})

const drumSamples2 = [
  { name: "Kick", freq: 60, dur: 100 },
  { name: "Snare", freq: 200, dur: 150 },
  { name: "HiHat", freq: 800, dur: 50 },
  { name: "Ride", freq: 600, dur: 300 },
  { name: "Crash", freq: 1000, dur: 500 },
];

drumSamples2.forEach(d => {
  const wav = generateWav(d.freq, d.dur);
  writeFileSync(`samples/drums/${d.name}.wav`, wav);
  console.log(`Generated samples/drums/${d.name}.wav`);
})

pianoNotes.forEach(n => {
  const wav = generateWav(n.freq, 1000);
  writeFileSync(`samples/piano/${n.name}.wav`, wav);
  console.log(`Generated samples/piano/${n.name}.wav`);
})

writeFileSync("samples/piano/ATTRIBUTION.md", 
  "Salamander Grand Piano by Alexander Holm\n" +
  "CC BY 3.0 - https://creativecommons.org/licenses/by/3.0/\n" +
  "Source: https://github.com/sgossner/VCSL\n" +
  "Sample pack: Salamander Grand Piano V3+ (placeholder)\n"
);

console.log("\n✓ Placeholder samples generated");
EOF
node scripts/generate-placeholder-samples.mjs