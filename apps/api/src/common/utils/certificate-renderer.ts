import type { Page } from "puppeteer";

const IMAGE_SIGNATURES: Record<string, (bytes: Buffer) => boolean> = {
  "image/png": (bytes) =>
    bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  "image/jpeg": (bytes) =>
    bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/webp": (bytes) =>
    bytes.length > 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP",
  "image/gif": (bytes) =>
    bytes.length > 6 && ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6)),
};

export function isSafeCertificateAssetKey(key: string | null | undefined): key is string {
  return (
    !!key &&
    key === key.trim() &&
    !/[\u0000-\u001f\u007f]/.test(key) &&
    !/^(?:[a-z][a-z\d+.-]*:|\/\/|\\\\)/i.test(key)
  );
}

export function imageDataUri(bytes: Buffer | null, contentType: string | null): string | null {
  const mime = contentType?.toLowerCase().split(";")[0].trim();
  if (!bytes?.length || !mime || !IMAGE_SIGNATURES[mime]?.(bytes)) return null;
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

/** Set up the page before loading untrusted certificate markup. Never permit external subresources. */
export async function prepareCertificatePage(page: Page, html: string): Promise<void> {
  await page.setJavaScriptEnabled(false);
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (request.isInterceptResolutionHandled()) return;
    const url = request.url();
    void (url.startsWith("data:") || url.startsWith("blob:")
      ? request.continue()
      : request.abort());
  });
  await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector("body > *", { timeout: 5_000 });
  await page.waitForFunction(
    async () => {
      const images = Array.from(document.images);
      if (
        ("fonts" in document && document.fonts.status !== "loaded") ||
        !images.every((image) => image.complete && image.naturalWidth > 0)
      )
        return false;
      const element = document.querySelector<HTMLElement>("body > *");
      const background = element && getComputedStyle(element).backgroundImage;
      if (!background || background === "none") return true;
      const match = /^url\(["']?(data:[^)'\"]+)["']?\)$/.exec(background);
      if (!match) return false;
      const image = new Image();
      image.src = match[1];
      return image.decode().then(
        () => true,
        () => false,
      );
    },
    { polling: 100, timeout: 5_000 },
  );
}
