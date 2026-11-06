import { MENTINGO_LOGO_SVG, SUPPORTED_LANGUAGES } from "@repo/shared";

import { buildCertificateSharePageHtml } from "../certificate-share-page";

import type { CertificateSharePageContent } from "../certificates.share.types";

const content: CertificateSharePageContent = {
  language: SUPPORTED_LANGUAGES.EN,
  pageTitle: 'Course completion certificate for "Safety"',
  pageDescription: "Ada completed Safety and earned a certificate.",
  shareUrl: "https://acme.test/api/certificates/share?certificateId=1",
  shareImageUrl: "https://acme.test/api/certificates/share-image?certificateId=1",
  imageWidth: 1200,
  imageHeight: 849,
  homeUrl: "https://acme.test/",
  openLabel: "Open platform",
  logoUrl: "/api/settings/platform-logo/image?v=logo",
  faviconUrl: null,
  primaryColor: "#123456",
  contrastColor: "#fefefe",
  embeddedImage: "data:image/png;base64,AA==",
};

describe("certificate share page", () => {
  it("shows the tenant logo, a link back to the platform and the certificate", () => {
    const html = buildCertificateSharePageHtml(content);

    expect(html).toContain(
      '<img class="logo" src="/api/settings/platform-logo/image?v=logo" alt="" />',
    );
    expect(html).toContain('<a class="button" href="https://acme.test/">Open platform</a>');
    expect(html).toContain("background: #123456;");
    expect(html).toContain('src="data:image/png;base64,AA=="');
    expect(html).toContain(
      '<meta property="og:image" content="https://acme.test/api/certificates/share-image?certificateId=1" />',
    );
  });

  it("falls back to the Mentingo logo and colors when branding is missing or unsafe", () => {
    const html = buildCertificateSharePageHtml({
      ...content,
      logoUrl: null,
      primaryColor: "red;background:url(https://attacker.test)",
      contrastColor: null,
    });

    expect(html).toContain(`<span class="logo">${MENTINGO_LOGO_SVG}</span>`);
    expect(html).toContain("background: #3f58b6;");
    expect(html).toContain("color: #ffffff;");
    expect(html).not.toContain("attacker.test");
  });

  it("escapes every learner-controlled value", () => {
    const payload = '"><script>alert(1)</script>';
    const html = buildCertificateSharePageHtml({
      ...content,
      pageTitle: payload,
      pageDescription: payload,
      logoUrl: payload,
      openLabel: payload,
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});
