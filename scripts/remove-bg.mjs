import sharp from "sharp";
import { resolve } from "node:path";

const root = process.cwd();

async function removeWhiteBg() {
  const input = resolve(root, "public/tbl-logo.png");
  const output = resolve(root, "public/tbl-logo-transparent.png");

  const image = sharp(input);
  const { width, height } = await image.metadata();
  const raw = await image.ensureAlpha().raw().toBuffer();

  const fuzz = 30;
  for (let i = 0; i < raw.length; i += 4) {
    const r = raw[i], g = raw[i + 1], b = raw[i + 2];
    if (r >= 255 - fuzz && g >= 255 - fuzz && b >= 255 - fuzz) {
      raw[i + 3] = 0;
    }
  }

  await sharp(raw, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(output);

  console.log(`Saved: ${output}`);
}

async function removeRedBgFloodFill() {
  const input = resolve(root, "public/icon.jpg");
  const output = resolve(root, "public/icon.png");

  // Downscale to reasonable size first for speed, then process
  const image = sharp(input).resize(512, 512, { fit: "contain" });
  const { info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const raw = await sharp(input)
    .resize(width, height, { fit: "contain" })
    .ensureAlpha()
    .raw()
    .toBuffer();

  const visited = new Uint8Array(width * height);

  const isRed = (x, y) => {
    const idx = (y * width + x) * 4;
    const r = raw[idx], g = raw[idx + 1], b = raw[idx + 2];
    return r >= 170 && g <= 90 && b <= 90;
  };

  const setTransparent = (x, y) => {
    const idx = (y * width + x) * 4;
    raw[idx + 3] = 0;
  };

  const mark = (x, y) => {
    visited[y * width + x] = 1;
  };

  const isVisited = (x, y) => visited[y * width + x];

  // Use a stack-based flood fill (faster than queue-based BFS)
  const stack = [];

  // Seed from all edges
  for (let x = 0; x < width; x++) {
    if (!isVisited(x, 0)) stack.push(x, 0);
    if (!isVisited(x, height - 1)) stack.push(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    if (!isVisited(0, y)) stack.push(0, y);
    if (!isVisited(width - 1, y)) stack.push(width - 1, y);
  }

  while (stack.length > 0) {
    const y = stack.pop();
    const x = stack.pop();

    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (isVisited(x, y)) continue;
    mark(x, y);

    if (!isRed(x, y)) continue;

    setTransparent(x, y);

    stack.push(x - 1, y);
    stack.push(x + 1, y);
    stack.push(x, y - 1);
    stack.push(x, y + 1);
  }

  await sharp(raw, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(output);

  console.log(`Saved: ${output}`);
}

await removeWhiteBg();
console.log("Processing icon (flood-fill)...");
await removeRedBgFloodFill();
console.log("\nDone!");
