/**
 * Generate missing PWA splash screens using sharp (no Puppeteer).
 * Reads icon-t.png, composites it centered on a #CC0000 background.
 * Only generates files that don't already exist in public/pwa/.
 */
import sharp from "sharp";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const iconPath = resolve(root, "public/icon-t.png");
const splashDir = resolve(root, "public/pwa");
const htmlPath = resolve(root, "public/pwa/splash.html");
const BG = { r: 0xCC, g: 0x00, b: 0x00 };

// Parse all expected sizes from splash.html
const html = readFileSync(htmlPath, "utf8");
const hrefRe = /href="apple-splash-(\d+)-(\d+)\.jpg"/g;
const sizes = [];
let m;
while ((m = hrefRe.exec(html)) !== null) {
  sizes.push({ w: parseInt(m[1], 10), h: parseInt(m[2], 10) });
}

// Filter to missing only
const missing = sizes.filter(
  ({ w, h }) => !existsSync(resolve(splashDir, `apple-splash-${w}-${h}.jpg`))
);

if (missing.length === 0) {
  console.log("All splash screens already exist.");
  process.exit(0);
}

console.log(`Generating ${missing.length} missing splash screens...`);

// Load icon once
const iconBuffer = readFileSync(iconPath);

for (const { w, h } of missing) {
  // Icon should be ~24% of the shorter dimension
  const iconSize = Math.round(Math.min(w, h) * 0.24);
  const resizedIcon = await sharp(iconBuffer)
    .resize(iconSize, iconSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const left = Math.round((w - iconSize) / 2);
  const top = Math.round((h - iconSize) / 2);

  await sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: BG,
    },
  })
    .composite([{ input: resizedIcon, left, top }])
    .jpeg({ quality: 90 })
    .toFile(resolve(splashDir, `apple-splash-${w}-${h}.jpg`));

  console.log(`  Created apple-splash-${w}-${h}.jpg`);
}

console.log("Done!");
