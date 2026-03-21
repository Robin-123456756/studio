import sharp from "sharp";
import { resolve } from "node:path";

const root = process.cwd();
const input = resolve(root, "public/icon.png");
const output = resolve(root, "public/icon.png");

// Trim the transparent/dark edges, then re-add clean transparent padding
const trimmed = await sharp(input)
  .trim({ threshold: 20 })  // auto-trim near-black edges
  .toBuffer();

const meta = await sharp(trimmed).metadata();
console.log(`Trimmed to: ${meta.width}x${meta.height}`);

// Make it square with transparent padding
const size = Math.max(meta.width, meta.height);
await sharp(trimmed)
  .resize(size, size, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toFile(output);

console.log(`Saved clean icon: ${size}x${size}`);
