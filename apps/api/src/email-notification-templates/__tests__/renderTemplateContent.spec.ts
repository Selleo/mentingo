import { BadRequestException } from "@nestjs/common";
import {
  EMAIL_TEMPLATE_NODE_TYPES,
  EMAIL_TEMPLATE_NODE_UUID_ATTR,
  TENANT_LOGO_CID_SRC,
  TENANT_LOGO_VARIABLE,
} from "@repo/shared";

const mockRender = jest.fn();
const mockSetPreviewText = jest.fn();
const mockSetTheme = jest.fn();
const MockMaily = jest.fn().mockImplementation(() => ({
  render: mockRender,
  setPreviewText: mockSetPreviewText,
  setTheme: mockSetTheme,
}));

jest.mock("@maily-to/render", () => ({ Maily: MockMaily }));

import { renderTemplateContent } from "../utils/renderTemplateContent";

import type { EmailTemplateBlocks, EmailTemplateStrings } from "@repo/shared";

const EN = "en" as const;
const PL = "pl" as const;
const PRIMARY = "#4796FD";

const emptyBlocks: EmailTemplateBlocks = { type: EMAIL_TEMPLATE_NODE_TYPES.DOC, content: [] };
const emptyStrings: EmailTemplateStrings = {};
const uuid1 = "aaaaaaaa-0000-4000-8000-000000000001";

const logoBlocks: EmailTemplateBlocks = {
  type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
  content: [
    {
      type: EMAIL_TEMPLATE_NODE_TYPES.IMAGE,
      attrs: {
        src: TENANT_LOGO_VARIABLE,
        height: "32",
      },
    },
  ],
};

const translatedLinkBlocks: EmailTemplateBlocks = {
  type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
  content: [
    {
      type: EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH,
      attrs: { [EMAIL_TEMPLATE_NODE_UUID_ATTR]: uuid1 },
      content: [{ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text: "Base text" }],
    },
  ],
};

const bareBodyHtml = () =>
  "<!DOCTYPE html><html><head></head>" +
  '<body style="background-color:#fafafa">' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center">' +
  '<tbody><tr><td style="margin:0px;background-color:#fafafa;padding-top:0px">' +
  '<table align="center" width="100%" role="presentation" style="max-width:500px"><tbody><tr><td>content</td></tr></tbody></table>' +
  "</td></tr></tbody>" +
  "</table></body></html>";

const bodyHtmlWithBlocks = (count: number) => {
  const blocks = Array.from(
    { length: count },
    (_, i) => `<p id="b${i + 1}">Block ${i + 1}</p>`,
  ).join("");
  return (
    "<!DOCTYPE html><html><head></head>" +
    '<body style="background-color:#fafafa">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center">' +
    '<tbody><tr><td style="margin:0px;background-color:#fafafa;padding-top:0px">' +
    `<table align="center" width="100%" role="presentation" style="max-width:500px"><tbody><tr><td>${blocks}</td></tr></tbody></table>` +
    "</td></tr></tbody>" +
    "</table></body></html>"
  );
};

describe("renderTemplateContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRender.mockResolvedValue(bareBodyHtml());
  });

  it("returns the html unchanged when the wrapper td cannot be found (passthrough)", async () => {
    mockRender.mockResolvedValue("<html>test</html>");

    const result = await renderTemplateContent({
      blocks: emptyBlocks,
      strings: emptyStrings,
      subject: { [EN]: "Subject" },
      language: EN,
      baseLanguage: EN,
      primaryColor: PRIMARY,
    });

    expect(result.html).toBe("<html>test</html>");
  });

  it("returns the html unchanged when the card has no child blocks (passthrough)", async () => {
    const raw = bareBodyHtml();
    mockRender.mockResolvedValue(raw);

    const result = await renderTemplateContent({
      blocks: emptyBlocks,
      strings: emptyStrings,
      subject: { [EN]: "Subject" },
      language: EN,
      baseLanguage: EN,
      primaryColor: PRIMARY,
    });

    expect(result.html).toBe(raw);
  });

  it("splits blocks into two full-width sections: top primaryColor, bottom body bg with white card", async () => {
    mockRender.mockResolvedValue(bodyHtmlWithBlocks(4));

    const result = await renderTemplateContent({
      blocks: emptyBlocks,
      strings: emptyStrings,
      subject: { [EN]: "Subject" },
      language: EN,
      baseLanguage: EN,
      primaryColor: "#ff00aa",
    });

    expect(result.html).toContain("background-color:#ff00aa");
    expect(result.html).toContain("background-color:#fafafa");
    expect(result.html).toContain("background-color:#ffffff");
    expect(result.html).not.toContain("linear-gradient");
  });

  it("puts ceil(N/2) blocks in the top (primary) section and the rest in the bottom section", async () => {
    mockRender.mockResolvedValue(bodyHtmlWithBlocks(5));

    const result = await renderTemplateContent({
      blocks: emptyBlocks,
      strings: emptyStrings,
      subject: { [EN]: "Subject" },
      language: EN,
      baseLanguage: EN,
      primaryColor: "#ff00aa",
    });

    const topIdx = result.html.indexOf("background-color:#ff00aa");
    const bottomIdx = result.html.indexOf("background-color:#fafafa", topIdx + 1);
    expect(topIdx).toBeGreaterThan(-1);
    expect(bottomIdx).toBeGreaterThan(topIdx);

    const topSection = result.html.slice(topIdx, bottomIdx);
    const bottomSection = result.html.slice(bottomIdx);

    for (const i of [1, 2, 3]) {
      expect(topSection).toContain(`id="b${i}"`);
      expect(bottomSection).not.toContain(`id="b${i}"`);
    }
    for (const i of [4, 5]) {
      expect(bottomSection).toContain(`id="b${i}"`);
      expect(topSection).not.toContain(`id="b${i}"`);
    }
  });

  it("omits the bottom section when there is only one block", async () => {
    mockRender.mockResolvedValue(bodyHtmlWithBlocks(1));

    const result = await renderTemplateContent({
      blocks: emptyBlocks,
      strings: emptyStrings,
      subject: { [EN]: "Subject" },
      language: EN,
      baseLanguage: EN,
      primaryColor: "#ff00aa",
    });

    expect(result.html).toContain("background-color:#ff00aa");
    const bottomBgOccurrences = (result.html.match(/background-color:#fafafa/g) ?? []).length;
    expect(bottomBgOccurrences).toBe(1);
  });

  it("wraps the layout in a div with the body background so styles survive body stripping", async () => {
    mockRender.mockResolvedValue(bodyHtmlWithBlocks(4));

    const result = await renderTemplateContent({
      blocks: emptyBlocks,
      strings: emptyStrings,
      subject: { [EN]: "Subject" },
      language: EN,
      baseLanguage: EN,
      primaryColor: "#ff00aa",
    });

    const bodyOpenMatch = result.html.match(/<body([^>]*)>/);
    const bodyOpenAttrs = bodyOpenMatch?.[1] ?? "";
    expect(bodyOpenAttrs).not.toContain("background-color");
    expect(bodyOpenAttrs).not.toContain("style=");

    expect(result.html).toMatch(/<body[^>]*>\s*<div style="background-color:#fafafa;width:100%">/);
    expect(result.html).not.toMatch(/<body[^>]*>\s*<table/);
  });

  it("calls maily.setPreviewText when previewText is provided", async () => {
    await renderTemplateContent({
      blocks: emptyBlocks,
      strings: emptyStrings,
      subject: { [EN]: "Subject" },
      language: EN,
      baseLanguage: EN,
      primaryColor: PRIMARY,
      previewText: "Preview snippet",
    });

    expect(mockSetPreviewText).toHaveBeenCalledWith("Preview snippet");
  });

  it("does not call setPreviewText when previewText is absent", async () => {
    await renderTemplateContent({
      blocks: emptyBlocks,
      strings: emptyStrings,
      subject: { [EN]: "Subject" },
      language: EN,
      baseLanguage: EN,
      primaryColor: PRIMARY,
    });

    expect(mockSetPreviewText).not.toHaveBeenCalled();
  });

  it("configures the maily theme with fafafa body bg and a 500px rounded white card, no gradient", async () => {
    await renderTemplateContent({
      blocks: emptyBlocks,
      strings: emptyStrings,
      subject: { [EN]: "Subject" },
      language: EN,
      baseLanguage: EN,
      primaryColor: PRIMARY,
    });

    expect(mockSetTheme).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ backgroundColor: "#fafafa" }),
        container: expect.objectContaining({
          backgroundColor: "#ffffff",
          maxWidth: "500px",
          borderRadius: "24px",
        }),
      }),
    );
    const bodyTheme = mockSetTheme.mock.calls[0]?.[0]?.body ?? {};
    expect(bodyTheme).not.toHaveProperty("background");
  });

  it("replaces the tenant logo variable with cid:logo before rendering by default", async () => {
    await renderTemplateContent({
      blocks: logoBlocks,
      strings: emptyStrings,
      subject: { [EN]: "Subject" },
      language: EN,
      baseLanguage: EN,
      primaryColor: PRIMARY,
    });

    expect(MockMaily).toHaveBeenCalledWith(
      expect.objectContaining({
        content: [
          expect.objectContaining({
            attrs: expect.objectContaining({ src: TENANT_LOGO_CID_SRC }),
          }),
        ],
      }),
    );
  });

  it("replaces the tenant logo variable with an explicit preview logo source", async () => {
    await renderTemplateContent({
      blocks: logoBlocks,
      strings: emptyStrings,
      subject: { [EN]: "Subject" },
      language: EN,
      baseLanguage: EN,
      primaryColor: PRIMARY,
      tenantLogoSrc: "/api/settings/platform-logo/image?v=logo.png",
    });

    expect(MockMaily).toHaveBeenCalledWith(
      expect.objectContaining({
        content: [
          expect.objectContaining({
            attrs: expect.objectContaining({
              src: "/api/settings/platform-logo/image?v=logo.png",
            }),
          }),
        ],
      }),
    );
  });

  it("picks the target language subject", async () => {
    const result = await renderTemplateContent({
      blocks: emptyBlocks,
      strings: emptyStrings,
      subject: { [EN]: "EN subject", [PL]: "PL subject" },
      language: PL,
      baseLanguage: EN,
      primaryColor: PRIMARY,
    });

    expect(result.subject).toBe("PL subject");
  });

  it("falls back to base language subject when target language subject is missing", async () => {
    const result = await renderTemplateContent({
      blocks: emptyBlocks,
      strings: emptyStrings,
      subject: { [EN]: "EN subject" },
      language: PL,
      baseLanguage: EN,
      primaryColor: PRIMARY,
    });

    expect(result.subject).toBe("EN subject");
  });

  it("returns empty string subject when neither target nor base subject is available", async () => {
    const result = await renderTemplateContent({
      blocks: emptyBlocks,
      strings: emptyStrings,
      subject: {},
      language: PL,
      baseLanguage: EN,
      primaryColor: PRIMARY,
    });

    expect(result.subject).toBe("");
  });

  it("returns the resolved language in output", async () => {
    const result = await renderTemplateContent({
      blocks: emptyBlocks,
      strings: emptyStrings,
      subject: { [EN]: "Subject" },
      language: PL,
      baseLanguage: EN,
      primaryColor: PRIMARY,
    });

    expect(result.language).toBe(PL);
  });

  it("rejects unsafe hrefs introduced by translated strings before rendering", async () => {
    await expect(
      renderTemplateContent({
        blocks: translatedLinkBlocks,
        strings: {
          [PL]: {
            [uuid1]: [
              {
                type: EMAIL_TEMPLATE_NODE_TYPES.TEXT,
                text: "Unsafe link",
                marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
              },
            ],
          },
        },
        subject: { [EN]: "Subject" },
        language: PL,
        baseLanguage: EN,
        primaryColor: PRIMARY,
      }),
    ).rejects.toThrow(new BadRequestException("emailTemplates.toast.invalidUrl"));
    expect(MockMaily).not.toHaveBeenCalled();
  });
});
