/**
 * Template Engine — render a DOM node to a PNG Blob
 *
 * Uses the SVG foreignObject technique:
 * 1. Serialize the DOM node to an XHTML string
 * 2. Wrap it in an SVG <foreignObject>
 * 3. Draw the SVG onto a <canvas>
 * 4. Export the canvas as a PNG Blob
 *
 * No external dependencies required.
 */

/** Options for rendering a template to PNG */
export type RenderOptions = {
  /** Output width in px */
  width: number;
  /** Output height in px */
  height: number;
  /** Device pixel ratio for sharp output (default 2) */
  scale?: number;
};

/**
 * Render a DOM element to a PNG Blob.
 *
 * The element should be mounted in the document (can be visibility:hidden)
 * so that styles resolve correctly.
 */
export async function renderToPng(
  element: HTMLElement,
  options: RenderOptions
): Promise<Blob> {
  const { width, height, scale = 2 } = options;

  // 1. Clone and inline all computed styles so the SVG is self-contained
  const clone = element.cloneNode(true) as HTMLElement;
  inlineStyles(element, clone);

  // 1b. Convert all <img> src to data URLs (foreignObject can't load external images)
  await inlineImages(clone);

  // 2. Serialize to XHTML
  const xhtml = new XMLSerializer().serializeToString(clone);

  // 3. Build SVG wrapper
  const svgData = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">${xhtml}</div>
      </foreignObject>
    </svg>
  `;

  // 4. Create image from SVG data URL
  const img = new Image();
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load SVG image"));
    img.src = url;
  });

  // 5. Draw onto canvas at requested scale
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, width, height);

  URL.revokeObjectURL(url);

  // 6. Export as PNG blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas export failed"))),
      "image/png"
    );
  });
}

/**
 * Recursively copy computed styles from the source node to the clone.
 * This ensures the SVG foreignObject renders identically.
 */
function inlineStyles(source: Element, target: Element) {
  const computed = window.getComputedStyle(source);
  const targetEl = target as HTMLElement;

  // Copy all computed style properties
  for (let i = 0; i < computed.length; i++) {
    const prop = computed[i];
    targetEl.style.setProperty(prop, computed.getPropertyValue(prop));
  }

  // Recurse into children
  const sourceChildren = source.children;
  const targetChildren = target.children;
  for (let i = 0; i < sourceChildren.length; i++) {
    if (targetChildren[i]) {
      inlineStyles(sourceChildren[i], targetChildren[i]);
    }
  }
}

/**
 * Find all <img> elements in a DOM tree and replace their src with
 * base64 data URLs so the SVG foreignObject export includes them.
 * Skips images that are already data URLs.
 * Failures are silently ignored — the image simply won't appear in the export.
 */
async function inlineImages(root: HTMLElement): Promise<void> {
  const imgs = root.querySelectorAll("img");
  const promises = Array.from(imgs).map(async (img) => {
    const src = img.getAttribute("src");
    if (!src || src.startsWith("data:")) return;
    try {
      const dataUrl = await imageToDataUrl(src);
      img.setAttribute("src", dataUrl);
    } catch {
      // Image failed to load — leave it as-is (will be blank in export)
    }
  });
  await Promise.all(promises);
}

/**
 * Convert an image URL to a base64 data URL.
 * Needed because SVG foreignObject can't load external images.
 */
export async function imageToDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
