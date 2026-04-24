// One-shot favicon generator. Run with `node scripts/gen-favicon.mjs`.
// Produces a multi-size favicon.ico (16/32/48) plus standalone PNGs
// (16, 32, 48, 180 apple-touch, 192, 512) in public/ from the
// Kodama yokai sprite (first merge tier — bright green, most
// recognisable at small sizes).
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const src = "public/yokai/kodama.png";

await sharp(src).resize(16, 16).png().toFile("public/icon-16.png");
await sharp(src).resize(32, 32).png().toFile("public/icon-32.png");
await sharp(src).resize(48, 48).png().toFile("public/icon-48.png");
await sharp(src).resize(180, 180).png().toFile("public/apple-touch-icon.png");
await sharp(src).resize(192, 192).png().toFile("public/icon-192.png");
await sharp(src).resize(512, 512).png().toFile("public/icon-512.png");

// sharp cannot write .ico directly — build one from three PNG frames.
// ICO spec: 6-byte ICONDIR + 16 bytes per ICONDIRENTRY + PNG payloads.
const [b16, b32, b48] = await Promise.all([
  sharp(src).resize(16, 16).png().toBuffer(),
  sharp(src).resize(32, 32).png().toBuffer(),
  sharp(src).resize(48, 48).png().toBuffer(),
]);

const sizes = [
  { size: 16, buf: b16 },
  { size: 32, buf: b32 },
  { size: 48, buf: b48 },
];
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type = icon
header.writeUInt16LE(sizes.length, 4);

const entries = [];
let offset = 6 + sizes.length * 16;
for (const { size, buf } of sizes) {
  const e = Buffer.alloc(16);
  e.writeUInt8(size === 256 ? 0 : size, 0); // width (0 means 256)
  e.writeUInt8(size === 256 ? 0 : size, 1); // height
  e.writeUInt8(0, 2); // palette colours
  e.writeUInt8(0, 3); // reserved
  e.writeUInt16LE(1, 4); // colour planes
  e.writeUInt16LE(32, 6); // bits per pixel
  e.writeUInt32LE(buf.length, 8); // payload size
  e.writeUInt32LE(offset, 12); // payload offset
  offset += buf.length;
  entries.push(e);
}

const ico = Buffer.concat([header, ...entries, ...sizes.map((s) => s.buf)]);
writeFileSync("public/favicon.ico", ico);

console.log(
  `OK — favicon.ico (${ico.length} bytes), icon-16/32/48/192/512.png, apple-touch-icon.png`
);
