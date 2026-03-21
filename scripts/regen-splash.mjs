import sharp from "sharp";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const splashDir = resolve(root, "public/pwa");
const iconPath = resolve(root, "public/icon.png");
const BG_COLOR = { r: 74, g: 4, b: 4, alpha: 1 }; // #4A0404

// Get all existing splash files to know the sizes we need
const files = readdirSync(splashDir).filter(
  (f) => f.startsWith("apple-splash-") && f.endsWith(".jpg")
);

console.log(`Found ${files.length} splash images to regenerate...`);

for (const file of files) {
  // Parse dimensions from filename: apple-splash-1125-2436.jpg
  const match = file.match(/apple-splash-(\d+)-(\d+)\.jpg/);
  if (!match) continue;

  const width = parseInt(match[1], 10);
  const height = parseInt(match[2], 10);

  // Icon size: 24% of the shorter dimension
  const shorter = Math.min(width, height);
  const iconSize = Math.round(shorter * 0.24);

  const resizedIcon = await sharp(iconPath)
    .resize(iconSize, iconSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: BG_COLOR,
    },
  })
    .composite([
      {
        input: resizedIcon,
        gravity: "centre",
      },
    ])
    .jpeg({ quality: 90 })
    .toFile(resolve(splashDir, file));

  console.log(`  ${file} (${width}x${height})`);
}

console.log("\nAll splash images regenerated with Oxford Red (#4A0404)!");
