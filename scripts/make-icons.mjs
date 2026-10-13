// Generates public/icon-192.png + icon-512.png with zero dependencies
// (raw RGB scanlines -> zlib -> PNG with hand-rolled CRC32).
// Re-run: node scripts/make-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.slice(4, 8 + data.length)));
  return out;
}

/** Dark tile + cream note-head circle + stem. */
function iconPng(size) {
  const bg = [11, 11, 15];
  const cream = [245, 234, 214];
  const cx = size * 0.42;
  const cy = size * 0.62;
  const r = size * 0.15;
  const stemX0 = size * 0.52;
  const stemX1 = size * 0.565;
  const stemY0 = size * 0.2;
  const lines = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    lines[y * (size * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const inHead = (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
      const inStem = x >= stemX0 && x <= stemX1 && y >= stemY0 && y <= cy;
      const c = inHead || inStem ? cream : bg;
      const o = y * (size * 3 + 1) + 1 + x * 3;
      lines[o] = c[0];
      lines[o + 1] = c[1];
      lines[o + 2] = c[2];
    }
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, size);
  dv.setUint32(4, size);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  const sig = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk("IHDR", ihdr), chunk("IDAT", new Uint8Array(deflateSync(lines))), chunk("IEND", new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

writeFileSync("public/icon-192.png", iconPng(192));
writeFileSync("public/icon-512.png", iconPng(512));
console.log("icons written");
