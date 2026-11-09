import { MENTINGO_LOGO_SVG, normalizeCertificateColor } from "@repo/shared";
import { escape } from "lodash";

import type { CertificateSharePageContent } from "./certificates.share.types";

const MENTINGO_PRIMARY_COLOR = "#3f58b6";
const MENTINGO_CONTRAST_COLOR = "#ffffff";

/** Public certificate share page: a branded top bar above the certificate image, with link-preview metadata. */
export function buildCertificateSharePageHtml(content: CertificateSharePageContent): string {
  const faviconUrl = content.faviconUrl ? escape(content.faviconUrl) : null;
  const primaryColor = normalizeCertificateColor(content.primaryColor, MENTINGO_PRIMARY_COLOR);
  const contrastColor = normalizeCertificateColor(content.contrastColor, MENTINGO_CONTRAST_COLOR);
  const homeUrl = escape(content.homeUrl);

  // Decorative: the link is labelled, so the tenant name or host never shows as alt text.
  const logoMarkup = content.logoUrl
    ? `<img class="logo" src="${escape(content.logoUrl)}" alt="" />`
    : `<span class="logo">${MENTINGO_LOGO_SVG}</span>`;

  return `<!DOCTYPE html>
<html lang="${escape(content.language)}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escape(content.pageTitle)}</title>
    <meta name="description" content="${escape(content.pageDescription)}" />
    <meta name="robots" content="noindex,noarchive" />
    <link rel="canonical" href="${escape(content.shareUrl)}" />
    ${faviconUrl ? `<link rel="icon" href="${faviconUrl}" />` : ""}
    ${faviconUrl ? `<link rel="apple-touch-icon" href="${faviconUrl}" />` : ""}
    <meta property="og:title" content="${escape(content.pageTitle)}" />
    <meta property="og:description" content="${escape(content.pageDescription)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${escape(content.shareUrl)}" />
    <meta property="og:image" content="${escape(content.shareImageUrl)}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="${content.imageWidth}" />
    <meta property="og:image:height" content="${content.imageHeight}" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@600&display=swap"
    />
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background: #f7f7f7;
        color-scheme: light;
        font-family: "Open Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .page {
        width: min(100%, ${content.imageWidth + 48}px);
        margin: 0 auto;
        padding: 32px 24px 48px;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      .topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
      .home { display: inline-flex; align-items: center; }
      .logo { display: block; height: 32px; width: auto; max-width: 200px; object-fit: contain; }
      .button {
        display: inline-flex;
        align-items: center;
        padding: 10px 16px;
        border-radius: 8px;
        background: ${primaryColor};
        color: ${contrastColor};
        font-size: 14px;
        font-weight: 600;
        text-decoration: none;
        white-space: nowrap;
      }
      .button:hover { filter: brightness(0.92); }
      .button:focus-visible { outline: 2px solid ${primaryColor}; outline-offset: 2px; }
      .certificate {
        display: block;
        width: 100%;
        height: auto;
        border-radius: 8px;
        background: #ffffff;
      }
      @media (max-width: 640px) {
        .page { padding: 16px 16px 32px; gap: 16px; }
        .logo { height: 24px; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <header class="topbar">
        <a class="home" href="${homeUrl}" aria-label="${escape(
          content.openLabel,
        )}">${logoMarkup}</a>
        <a class="button" href="${homeUrl}">${escape(content.openLabel)}</a>
      </header>
      <main>
        <img
          class="certificate"
          src="${escape(content.embeddedImage)}"
          alt="${escape(content.pageTitle)}"
          width="${content.imageWidth}"
          height="${content.imageHeight}"
        />
      </main>
    </div>
  </body>
</html>`;
}
