import sharp from "sharp";
import { resolve } from "node:path";

const root = process.cwd();
const iconPath = resolve(root, "public/icon.png");
const iconsDir = resolve(root, "public/icons");
const BG = { r: 74, g: 4, b: 4, alpha: 1 }; // #4A0404

const icons = [
  { name: "icon-192.png", size: 192, padding: 0.15 },
  { name: "icon-512.png", size: 512, padding: 0.15 },
  { name: "manifest-icon-192.maskable.png", size: 192, padding: 0.2 },
  { name: "manifest-icon-512.maskable.png", size: 512, padding: 0.2 },
  { name: "apple-icon-180.png", size: 180, padding: 0.15 },
];

for (const icon of icons) {
  const innerSize = Math.round(icon.size * (1 - icon.padding * 2));

  const resizedIcon = await sharp(iconPath)
    .resize(innerSize, innerSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  await sharp({
    create: {
      width: icon.size,
      height: icon.size,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: resizedIcon, gravity: "centre" }])
    .png()
    .toFile(resolve(iconsDir, icon.name));

  console.log(`  ${icon.name} (${icon.size}x${icon.size})`);
}

console.log("\nAll app icons regenerated!");
