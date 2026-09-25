import type { McpOAuthPage } from "./mcp-oauth-page.types";

export function escapeOAuthHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const escapes: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return escapes[char];
  });
}

function safeBrandImageUrl(value: string | null | undefined): string | null {
  if (!value || /[\s"'()<>\\]/.test(value)) return null;
  if (value.startsWith("/api/settings/")) return value;
  return /^https:\/\//.test(value) ? value : null;
}

export function renderMcpOAuthPage(page: McpOAuthPage): string {
  const primaryColor = /^#[\da-fA-F]{6}$/.test(page.brand?.primaryColor ?? "")
    ? page.brand!.primaryColor!
    : "#3f58b6";
  const contrastColor = /^#[\da-fA-F]{6}$/.test(page.brand?.contrastColor ?? "")
    ? page.brand!.contrastColor!
    : "#ffffff";
  const logoUrl = safeBrandImageUrl(page.brand?.logoUrl) ?? "/app/assets/svgs/app-logo.svg";
  const backgroundUrl = safeBrandImageUrl(page.brand?.backgroundUrl);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex,noarchive" />
    <title>${escapeOAuthHtml(page.title)} · Mentingo</title>
    <link rel="icon" href="/app/assets/svgs/app-signet.svg" type="image/svg+xml" />
    <style>
      :root { color-scheme: light; font-family: "Open Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; color: #0f172a;
        background: ${backgroundUrl ? `linear-gradient(rgba(248,250,252,.2), rgba(248,250,252,.2)), url("${backgroundUrl}") center / cover fixed` : "#f8fafc"}; }
      .card { width: min(100%, 440px); padding: 24px; background: #fcfcfc;
        border: 1px solid #e5e5e5; border-radius: 8px; box-shadow: 0 1px 2px rgba(18,21,33,.08); }
      .brand { display: flex; justify-content: center; margin-bottom: 32px; }
      .brand-logo { display: block; max-width: min(100%, 220px); max-height: 64px; object-fit: contain; }
      h1 { margin: 0 0 12px; font-size: 24px; line-height: 1.25; letter-spacing: -.02em; }
      p { margin: 0; line-height: 1.6; color: #676767; }
      .detail { margin-top: 16px; font-size: 14px; }
      .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; }
      .actions form { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; width: 100%; }
      button, .button { appearance: none; display: inline-flex; align-items: center; justify-content: center; min-height: 42px;
        padding: 10px 16px; border: 1px solid ${primaryColor}; border-radius: 8px; cursor: pointer;
        background: ${primaryColor}; color: ${contrastColor}; font: inherit; font-weight: 600; text-decoration: none; }
      button.secondary, .button.secondary { border-color: #cbd5e1; color: #334155; background: white; }
      button:focus-visible, .button:focus-visible { outline: 3px solid ${primaryColor}; outline-offset: 3px; }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="brand"><img class="brand-logo" src="${escapeOAuthHtml(logoUrl)}" alt="Mentingo" /></div>
      <h1>${escapeOAuthHtml(page.title)}</h1>
      <p>${escapeOAuthHtml(page.description)}</p>
      ${page.detail ? `<div class="detail">${escapeOAuthHtml(page.detail)}</div>` : ""}
      <div class="actions">${page.actions}</div>
    </main>
  </body>
</html>`;
}
