import { EMAIL_TEMPLATE_NODE_TYPES } from "@repo/shared";
import { describe, expect, it } from "vitest";

import {
  TENANT_LOGO_HEIGHT,
  TENANT_LOGO_PLACEHOLDER_SRC,
  TENANT_LOGO_VARIABLE,
  packTenantLogoInDoc,
  resolveEffectiveLogoUrl,
  resolveTenantLogoInDoc,
} from "./logoHeader";

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

describe("resolveEffectiveLogoUrl", () => {
  it("uses the tenant logo when one is configured", () => {
    expect(resolveEffectiveLogoUrl(logoUrl)).toBe(logoUrl);
  });

  it("uses the Mentingo logo fallback when no tenant logo is configured", () => {
    const result = resolveEffectiveLogoUrl(null);
    expect(result).toBeTruthy();
    expect(result).not.toBe(TENANT_LOGO_VARIABLE);
  });
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

  it("replaces TENANT_LOGO_VARIABLE src with the Mentingo logo fallback", () => {
    const blocks = doc(imageNode(TENANT_LOGO_VARIABLE));
    const result = resolveTenantLogoInDoc(blocks, TENANT_LOGO_PLACEHOLDER_SRC);
    expect(result).not.toBe(blocks);
    expect(result.content?.[0]?.attrs?.src).not.toBe(TENANT_LOGO_VARIABLE);
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

  it("normalizes the tenant logo width to null and height to 32 so Maily's auto-fit override is bypassed", () => {
    const blocks: EmailTemplateBlocks = {
      type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
      content: [
        {
          type: EMAIL_TEMPLATE_NODE_TYPES.IMAGE,
          attrs: {
            uuid: "img-uuid",
            src: TENANT_LOGO_VARIABLE,
            alignment: "center",
            width: "auto",
            height: TENANT_LOGO_HEIGHT,
          },
        },
      ],
    };
    const result = resolveTenantLogoInDoc(blocks, logoUrl);
    expect(result.content?.[0]?.attrs).toMatchObject({
      src: logoUrl,
      width: null,
      height: TENANT_LOGO_HEIGHT,
      alignment: "center",
    });
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

  it("replaces the Mentingo logo fallback with TENANT_LOGO_VARIABLE", () => {
    const blocks = doc(imageNode(TENANT_LOGO_PLACEHOLDER_SRC));
    const result = packTenantLogoInDoc(blocks, null);
    expect(result.content?.[0]?.attrs?.src).toBe(TENANT_LOGO_VARIABLE);
  });

  it("returns doc unchanged when logo url is not found in the doc", () => {
    const blocks = doc(imageNode("https://different.com/img.png"));
    const result = packTenantLogoInDoc(blocks, logoUrl);
    expect(result).toBe(blocks);
  });

  it("normalizes the tenant logo's width/height even when Maily's auto-fit has overwritten them to numeric values", () => {
    const blocks: EmailTemplateBlocks = {
      type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
      content: [
        {
          type: EMAIL_TEMPLATE_NODE_TYPES.IMAGE,
          attrs: {
            uuid: "img-uuid",
            src: logoUrl,
            alignment: "center",
            width: 512,
            height: 128,
            aspectRatio: 4,
          },
        },
      ],
    };
    const result = packTenantLogoInDoc(blocks, logoUrl);
    expect(result.content?.[0]?.attrs).toMatchObject({
      src: TENANT_LOGO_VARIABLE,
      width: "auto",
      height: TENANT_LOGO_HEIGHT,
      aspectRatio: 4,
    });
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
