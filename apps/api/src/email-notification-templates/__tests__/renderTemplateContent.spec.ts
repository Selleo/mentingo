import { EMAIL_TEMPLATE_NODE_TYPES } from "@repo/shared";

const mockRender = jest.fn();
const mockSetPreviewText = jest.fn();
const MockMaily = jest.fn().mockImplementation(() => ({
  render: mockRender,
  setPreviewText: mockSetPreviewText,
}));

jest.mock("@maily-to/render", () => ({ Maily: MockMaily }));

import { renderTemplateContent } from "../utils/renderTemplateContent";

import type { EmailTemplateBlocks, EmailTemplateStrings } from "@repo/shared";

const EN = "en" as const;
const PL = "pl" as const;

const emptyBlocks: EmailTemplateBlocks = { type: EMAIL_TEMPLATE_NODE_TYPES.DOC, content: [] };
const emptyStrings: EmailTemplateStrings = {};

describe("renderTemplateContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRender.mockResolvedValue("<html>rendered</html>");
  });

  it("returns the html from Maily.render()", async () => {
    mockRender.mockResolvedValue("<html>test</html>");

    const result = await renderTemplateContent({
      blocks: emptyBlocks,
      strings: emptyStrings,
      subject: { [EN]: "Subject" },
      language: EN,
      baseLanguage: EN,
    });

    expect(result.html).toBe("<html>test</html>");
  });

  it("calls maily.setPreviewText when previewText is provided", async () => {
    await renderTemplateContent({
      blocks: emptyBlocks,
      strings: emptyStrings,
      subject: { [EN]: "Subject" },
      language: EN,
      baseLanguage: EN,
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
    });

    expect(mockSetPreviewText).not.toHaveBeenCalled();
  });

  it("picks the target language subject", async () => {
    const result = await renderTemplateContent({
      blocks: emptyBlocks,
      strings: emptyStrings,
      subject: { [EN]: "EN subject", [PL]: "PL subject" },
      language: PL,
      baseLanguage: EN,
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
    });

    expect(result.language).toBe(PL);
  });
});
