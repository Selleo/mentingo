import { ALLOWED_LESSON_IMAGE_FILE_TYPES } from "@repo/shared";

import type { HTTPRequest, Page } from "puppeteer";
import type { FileService } from "src/file/file.service";

const ASSET_TIMEOUT_MS = 5_000;
const ASSET_POLL_INTERVAL_MS = 100;

/** Lets the certificate page load only embedded `data:`/`blob:` assets; every other request is aborted. */
export async function handleCertificateRequest(request: HTTPRequest): Promise<void> {
  if (request.isInterceptResolutionHandled()) return;

  const embedded = /^(data|blob):/i.test(request.url());
  await (embedded ? request.continue() : request.abort("blockedbyclient")).catch(() => {});
}

/** Locks a certificate page down before content is set: no JavaScript and no network access. */
export async function prepareCertificatePage(page: Page): Promise<void> {
  await page.setJavaScriptEnabled(false);
  await page.setRequestInterception(true);
  page.on("request", handleCertificateRequest);
}

/** Waits until fonts, images and background images are decoded so the PDF/PNG is complete. */
export async function waitForCertificateAssets(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (!("fonts" in document) || document.fonts.status === "loaded") &&
      Array.from(document.images).every((image) => image.complete),
    { timeout: ASSET_TIMEOUT_MS, polling: ASSET_POLL_INTERVAL_MS },
  );

  await page.evaluate(decodeCertificateBackgrounds, ASSET_TIMEOUT_MS);
}

/** Embeds a stored image as a data URI; external URLs and non-image files are rejected. */
export async function getCertificateImageDataUri(
  fileService: Pick<FileService, "getRawFileBuffer" | "getFileContentType">,
  reference?: string | null,
): Promise<string | null> {
  if (!isStorageReference(reference)) return null;

  try {
    const contentType = await fileService.getFileContentType(reference);
    if (!contentType || !ALLOWED_LESSON_IMAGE_FILE_TYPES.includes(contentType)) return null;

    const buffer = await fileService.getRawFileBuffer(reference);
    if (!buffer?.length) return null;

    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

async function decodeCertificateBackgrounds(timeoutMs: number): Promise<void> {
  const backgrounds = Array.from(document.querySelectorAll<HTMLElement>("[style]"))
    .map((element) => element.style.backgroundImage.match(/^url\("(data:[^"]+)"\)$/)?.[1])
    .filter((src): src is string => Boolean(src));

  if (!backgrounds.length) return;

  const decoding = backgrounds.map(async (src) => {
    const image = new Image();
    image.src = src;
    await image.decode().catch(() => {});
  });

  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Certificate background timed out")), timeoutMs);
  });

  try {
    await Promise.race([Promise.all(decoding), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function isStorageReference(reference: string | null | undefined): reference is string {
  if (!reference || reference !== reference.trim()) return false;
  if (reference.startsWith("//")) return false;

  return !/^[a-z][a-z\d+.-]*:/i.test(reference);
}
