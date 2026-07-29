import {
  EMAIL_TEMPLATE_NODE_TYPES,
  EMAIL_TEMPLATE_NODE_UUID_ATTR,
  SUPPORTED_LANGUAGES,
  TENANT_LOGO_VARIABLE,
  computeEmailTemplateDiagnostics,
  groupEmailTemplateDiagnostics,
} from "@repo/shared";
import { describe, expect, it } from "vitest";

import type { EmailTemplateBlocks, EmailTemplateStrings } from "@repo/shared";

const uuid1 = "aaaaaaaa-0000-4000-8000-000000000001";

const para = (uuid: string, text?: string): EmailTemplateBlocks => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH,
  attrs: { [EMAIL_TEMPLATE_NODE_UUID_ATTR]: uuid },
  content: text ? [{ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text }] : [],
});

const button = (uuid: string, text: string, url: string): EmailTemplateBlocks => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.BUTTON,
  attrs: { [EMAIL_TEMPLATE_NODE_UUID_ATTR]: uuid, text, url },
});

const image = (uuid: string, src: string): EmailTemplateBlocks => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.IMAGE,
  attrs: { [EMAIL_TEMPLATE_NODE_UUID_ATTR]: uuid, src },
});

const logoBrandingNode = (): EmailTemplateBlocks => image("logo-uuid", TENANT_LOGO_VARIABLE);

const footerNode = (): EmailTemplateBlocks => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.FOOTER,
  attrs: { [EMAIL_TEMPLATE_NODE_UUID_ATTR]: "footer-uuid" },
  content: [{ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text: "footer text" }],
});

const doc = (...children: EmailTemplateBlocks[]): EmailTemplateBlocks => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
  content: children,
});

const base = SUPPORTED_LANGUAGES.EN;
const other = SUPPORTED_LANGUAGES.PL;

const defaultSubject = { [base]: "Hello" };
const defaultStrings: EmailTemplateStrings = {};

describe("computeEmailTemplateDiagnostics — name_missing", () => {
  it("flags empty name", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "",
      availableLocales: [base],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(para(uuid1, "body")),
      strings: defaultStrings,
    });
    expect(result.some((d) => d.reason === "name_missing")).toBe(true);
  });

  it("flags whitespace-only name", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "   ",
      availableLocales: [base],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(para(uuid1, "body")),
      strings: defaultStrings,
    });
    expect(result.some((d) => d.reason === "name_missing")).toBe(true);
  });

  it("does not flag a valid name", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "My template",
      availableLocales: [base],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(para(uuid1, "body")),
      strings: defaultStrings,
    });
    expect(result.some((d) => d.reason === "name_missing")).toBe(false);
  });
});

describe("computeEmailTemplateDiagnostics — no_language_versions", () => {
  it("flags empty availableLocales", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(para(uuid1, "body")),
      strings: defaultStrings,
    });
    expect(result.some((d) => d.reason === "no_language_versions")).toBe(true);
  });
});

describe("computeEmailTemplateDiagnostics — subject_missing", () => {
  it("flags missing base-language subject", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [base],
      baseLanguage: base,
      subject: {},
      blocks: doc(para(uuid1, "body")),
      strings: defaultStrings,
    });
    expect(result.some((d) => d.reason === "subject_missing" && d.language === base)).toBe(true);
  });

  it("flags whitespace-only subject", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [base],
      baseLanguage: base,
      subject: { [base]: "   " },
      blocks: doc(para(uuid1, "body")),
      strings: defaultStrings,
    });
    expect(result.some((d) => d.reason === "subject_missing")).toBe(true);
  });
});

describe("computeEmailTemplateDiagnostics — body_missing", () => {
  it("flags a doc with no translatable nodes", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [base],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(),
      strings: defaultStrings,
    });
    expect(result.some((d) => d.reason === "body_missing")).toBe(true);
  });

  it("does not flag when a paragraph is present", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [base],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(para(uuid1, "text")),
      strings: defaultStrings,
    });
    expect(result.some((d) => d.reason === "body_missing")).toBe(false);
  });
});

describe("computeEmailTemplateDiagnostics — footer_missing", () => {
  it("emits a warning when no footer node is present", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [base],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(para(uuid1, "body")),
      strings: defaultStrings,
    });
    const d = result.find((x) => x.reason === "footer_missing");
    expect(d).toBeDefined();
    expect(d?.severity).toBe("warning");
  });

  it("does not flag when a footer node is present", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [base],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(para(uuid1, "body"), footerNode()),
      strings: defaultStrings,
    });
    expect(result.some((d) => d.reason === "footer_missing")).toBe(false);
  });
});

describe("computeEmailTemplateDiagnostics — logo_branding_missing", () => {
  it("emits a warning when no tenant logo node is present", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [base],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(para(uuid1, "body"), footerNode()),
      strings: defaultStrings,
    });
    const d = result.find((x) => x.reason === "logo_branding_missing");
    expect(d).toBeDefined();
    expect(d?.severity).toBe("warning");
  });

  it("does not flag when a tenant logo node is present", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [base],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(logoBrandingNode(), para(uuid1, "body"), footerNode()),
      strings: defaultStrings,
    });
    expect(result.some((d) => d.reason === "logo_branding_missing")).toBe(false);
  });
});

describe("computeEmailTemplateDiagnostics — button_label_missing / button_url_missing", () => {
  it("flags button with empty text", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [base],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(button(uuid1, "", "https://example.com")),
      strings: defaultStrings,
    });
    expect(result.some((d) => d.reason === "button_label_missing")).toBe(true);
  });

  it("flags button with empty url", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [base],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(button(uuid1, "Click", "")),
      strings: defaultStrings,
    });
    expect(result.some((d) => d.reason === "button_url_missing")).toBe(true);
  });

  it("does not flag a complete button", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [base],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(button(uuid1, "Click", "https://example.com")),
      strings: defaultStrings,
    });
    expect(result.some((d) => d.reason === "button_label_missing")).toBe(false);
    expect(result.some((d) => d.reason === "button_url_missing")).toBe(false);
  });
});

describe("computeEmailTemplateDiagnostics — invalid_url_protocol", () => {
  it("flags button with javascript: protocol", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [base],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(button(uuid1, "Click", "javascript:alert(1)")),
      strings: defaultStrings,
    });
    expect(result.some((d) => d.reason === "invalid_url_protocol")).toBe(true);
  });

  it("flags image with invalid protocol", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [base],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(image(uuid1, "ftp://example.com/img.png")),
      strings: defaultStrings,
    });
    expect(result.some((d) => d.reason === "invalid_url_protocol")).toBe(true);
  });

  it("does not flag a variable url that parses after substitution", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [base],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(button(uuid1, "Click", "{{site.url}}/path")),
      strings: defaultStrings,
    });
    expect(result.some((d) => d.reason === "invalid_url_protocol")).toBe(false);
  });

  it("does not flag an unparseable url that contains a variable", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [base],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(button(uuid1, "Click", "{{not-a-url}}")),
      strings: defaultStrings,
    });
    expect(result.some((d) => d.reason === "invalid_url_protocol")).toBe(false);
  });

  it("flags an unparseable url without variables", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [base],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(button(uuid1, "Click", "not a url at all")),
      strings: defaultStrings,
    });
    expect(result.some((d) => d.reason === "invalid_url_protocol")).toBe(true);
  });

  it("accepts https: protocol", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [base],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(button(uuid1, "Click", "https://example.com")),
      strings: defaultStrings,
    });
    expect(result.some((d) => d.reason === "invalid_url_protocol")).toBe(false);
  });

  it("accepts root-relative image URLs", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [base],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(image(uuid1, "/api/public/email-template-image/foo.webp")),
      strings: defaultStrings,
    });
    expect(result.some((d) => d.reason === "invalid_url_protocol")).toBe(false);
  });

  it("accepts mailto: protocol", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [base],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(button(uuid1, "Click", "mailto:hi@example.com")),
      strings: defaultStrings,
    });
    expect(result.some((d) => d.reason === "invalid_url_protocol")).toBe(false);
  });
});

describe("computeEmailTemplateDiagnostics — empty_translation", () => {
  it("flags empty base-language paragraph as error", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [base],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(para(uuid1)),
      strings: defaultStrings,
    });
    const d = result.find((x) => x.reason === "empty_translation" && x.language === base);
    expect(d).toBeDefined();
    expect(d?.severity).toBe("error");
  });

  it("flags empty non-base-language paragraph as warning", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [base, other],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(para(uuid1, "base text")),
      strings: {
        [base]: { [uuid1]: [{ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text: "base text" }] },
        [other]: { [uuid1]: [] },
      },
    });
    const d = result.find((x) => x.reason === "empty_translation" && x.language === other);
    expect(d).toBeDefined();
    expect(d?.severity).toBe("warning");
  });

  it("uses attrs.text for button base-language check", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [base],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(button(uuid1, "Click me", "https://example.com")),
      strings: defaultStrings,
    });
    expect(result.some((d) => d.reason === "empty_translation")).toBe(false);
  });
});

describe("computeEmailTemplateDiagnostics — unchanged_from_base", () => {
  it("warns when non-base translation matches base text", () => {
    const fragment = [{ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text: "same text" }];
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [base, other],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(para(uuid1, "same text")),
      strings: {
        [base]: { [uuid1]: fragment },
        [other]: { [uuid1]: fragment },
      },
    });
    const d = result.find((x) => x.reason === "unchanged_from_base" && x.language === other);
    expect(d).toBeDefined();
    expect(d?.severity).toBe("warning");
  });

  it("does not warn when non-base translation differs", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [base, other],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(para(uuid1, "hello")),
      strings: {
        [base]: { [uuid1]: [{ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text: "hello" }] },
        [other]: { [uuid1]: [{ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text: "cześć" }] },
      },
    });
    expect(result.some((d) => d.reason === "unchanged_from_base")).toBe(false);
  });

  it("does not emit unchanged_from_base for the base language itself", () => {
    const fragment = [{ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text: "text" }];
    const result = computeEmailTemplateDiagnostics({
      name: "T",
      availableLocales: [base],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(para(uuid1, "text")),
      strings: { [base]: { [uuid1]: fragment } },
    });
    expect(result.some((d) => d.reason === "unchanged_from_base")).toBe(false);
  });
});

describe("computeEmailTemplateDiagnostics — severity shape", () => {
  it("returns error severity for name_missing", () => {
    const result = computeEmailTemplateDiagnostics({
      name: "",
      availableLocales: [base],
      baseLanguage: base,
      subject: defaultSubject,
      blocks: doc(para(uuid1, "body")),
      strings: defaultStrings,
    });
    const d = result.find((x) => x.reason === "name_missing");
    expect(d?.severity).toBe("error");
  });
});

describe("groupEmailTemplateDiagnostics", () => {
  const unknownUuid = "bbbbbbbb-0000-4000-8000-000000000002";

  it("places diagnostics with a known uuid in byNodeUuid", () => {
    const diagnostic = {
      severity: "warning",
      reason: "empty_translation",
      nodeUuid: uuid1,
    } as const;

    const result = groupEmailTemplateDiagnostics([diagnostic], new Set([uuid1]));

    expect(result.byNodeUuid.get(uuid1)).toEqual([diagnostic]);
    expect(result.orphan).toEqual([]);
  });

  it("places diagnostics with an unknown uuid in orphan", () => {
    const diagnostic = {
      severity: "error",
      reason: "button_url_missing",
      nodeUuid: unknownUuid,
    } as const;

    const result = groupEmailTemplateDiagnostics([diagnostic], new Set([uuid1]));

    expect(result.byNodeUuid.has(unknownUuid)).toBe(false);
    expect(result.orphan).toEqual([diagnostic]);
  });

  it("places diagnostics without a uuid in orphan", () => {
    const diagnostic = {
      severity: "warning",
      reason: "footer_missing",
    } as const;

    const result = groupEmailTemplateDiagnostics([diagnostic], new Set([uuid1]));

    expect(result.byNodeUuid.size).toBe(0);
    expect(result.orphan).toEqual([diagnostic]);
  });

  it("orders diagnostics within a bucket with errors first", () => {
    const warning = {
      severity: "warning",
      reason: "empty_translation",
      language: "pl",
      nodeUuid: uuid1,
    } as const;
    const error = {
      severity: "error",
      reason: "button_url_missing",
      language: "en",
      nodeUuid: uuid1,
    } as const;
    const secondError = {
      severity: "error",
      reason: "button_label_missing",
      language: "en",
      nodeUuid: uuid1,
    } as const;

    const result = groupEmailTemplateDiagnostics([warning, error, secondError], new Set([uuid1]));

    expect(result.byNodeUuid.get(uuid1)).toEqual([secondError, error, warning]);
  });
});
