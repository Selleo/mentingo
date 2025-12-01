export const SVG_MIME_TYPE = "image/svg+xml";

export function isSvgUrl(url?: string | null): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.endsWith(".svg") || lower.startsWith("data:image/svg+xml");
}

export function isFixedPixelValue(value: string | null): boolean {
  return !!value && (/^\d*\.?\d+px$/.test(value) || /^\d*\.?\d+$/.test(value));
}

/**
 * Mutates provided SVG Document to set width/height from viewBox when missing or not fixed.
 * Returns true if mutation was applied.
 */
export function setFixedSizeFromViewBox(svgDoc: Document): boolean {
  const svg = svgDoc.querySelector("svg");
  if (!svg) return false;

  const widthAttr = svg.getAttribute("width");
  const heightAttr = svg.getAttribute("height");
  if (isFixedPixelValue(widthAttr) && isFixedPixelValue(heightAttr)) {
    return false;
  }

  const viewBox = svg.getAttribute("viewBox");
  const parts = viewBox?.split(/[\s,]+/) ?? [];
  const viewBoxWidth = parts[2];
  const viewBoxHeight = parts[3];
  if (!viewBoxWidth || !viewBoxHeight) return false;

  svg.setAttribute("width", viewBoxWidth);
  svg.setAttribute("height", viewBoxHeight);
  return true;
}

export async function preprocessSvgFile(file: File): Promise<File> {
  try {
    const text = await file.text();
    const parser = new DOMParser();
    const svg = parser.parseFromString(text, SVG_MIME_TYPE);
    const hasSvgChanged = setFixedSizeFromViewBox(svg);
    if (!hasSvgChanged) return file;

    const serializer = new XMLSerializer();
    const fixedSvgText = serializer.serializeToString(svg);
    const fixedBlob = new Blob([fixedSvgText], { type: SVG_MIME_TYPE });
    return new File([fixedBlob], file.name, { type: SVG_MIME_TYPE });
  } catch {
    return file;
  }
}

/**
 * Returns a blob: URL if preprocessing applied; otherwise returns null to indicate original should be used.
 * Caller is responsible for revoking the returned object URL when no longer needed.
 */
export async function preprocessSvgUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const svgText = await res.text();
    const parser = new DOMParser();
    const svg = parser.parseFromString(svgText, SVG_MIME_TYPE);
    const hasSvgChanged = setFixedSizeFromViewBox(svg);
    if (!hasSvgChanged) return null;

    const serializer = new XMLSerializer();
    const fixedSvgText = serializer.serializeToString(svg);
    const blob = new Blob([fixedSvgText], { type: SVG_MIME_TYPE });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}
