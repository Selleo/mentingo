import { EMAIL_TEMPLATE_NODE_TYPES } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { TENANT_LOGO_VARIABLE, packTenantLogoInDoc, resolveTenantLogoInDoc } from "./logoHeader";

import type { EmailTemplateBlocks } from "@repo/shared";

const logoUrl = "https://tenant.example.com/logo.png";

const imageNode = (src: string): EmailTemplateBlocks => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.IMAGE,
  attrs: { uuid: "img-uuid", src, alignment: "center" },
});

const doc = (...children: EmailTemplateBlocks[]): EmailTemplateBlocks => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
  content: children,
});

describe("resolveTenantLogoInDoc", () => {
  it("returns the doc unchanged (same reference) when logoUrl is null", () => {
    const original = doc(imageNode(TENANT_LOGO_VARIABLE));
    const result = resolveTenantLogoInDoc(original, null);
    expect(result).toBe(original);
  });

  it("replaces TENANT_LOGO_VARIABLE src with the real logo url", () => {
    const blocks = doc(imageNode(TENANT_LOGO_VARIABLE));
    const result = resolveTenantLogoInDoc(blocks, logoUrl);
    expect(result.content?.[0]?.attrs?.src).toBe(logoUrl);
  });

  it("returns the doc unchanged when there is no image with TENANT_LOGO_VARIABLE", () => {
    const blocks = doc(imageNode("https://other.com/img.png"));
    const result = resolveTenantLogoInDoc(blocks, logoUrl);
    expect(result).toBe(blocks);
  });

  it("preserves other attrs on the image node", () => {
    const blocks = doc(imageNode(TENANT_LOGO_VARIABLE));
    const result = resolveTenantLogoInDoc(blocks, logoUrl);
    expect(result.content?.[0]?.attrs?.alignment).toBe("center");
  });
});

describe("packTenantLogoInDoc", () => {
  it("returns the doc unchanged when logoUrl is null", () => {
    const blocks = doc(imageNode(logoUrl));
    const result = packTenantLogoInDoc(blocks, null);
    expect(result).toBe(blocks);
  });

  it("replaces the real logo url with TENANT_LOGO_VARIABLE", () => {
    const blocks = doc(imageNode(logoUrl));
    const result = packTenantLogoInDoc(blocks, logoUrl);
    expect(result.content?.[0]?.attrs?.src).toBe(TENANT_LOGO_VARIABLE);
  });

  it("returns doc unchanged when logo url is not found in the doc", () => {
    const blocks = doc(imageNode("https://different.com/img.png"));
    const result = packTenantLogoInDoc(blocks, logoUrl);
    expect(result).toBe(blocks);
  });
});

describe("resolveTenantLogoInDoc + packTenantLogoInDoc round-trip", () => {
  it("round-trips correctly: resolve then pack returns TENANT_LOGO_VARIABLE", () => {
    const blocks = doc(imageNode(TENANT_LOGO_VARIABLE));
    const resolved = resolveTenantLogoInDoc(blocks, logoUrl);
    const packed = packTenantLogoInDoc(resolved, logoUrl);
    expect(packed.content?.[0]?.attrs?.src).toBe(TENANT_LOGO_VARIABLE);
  });
});
