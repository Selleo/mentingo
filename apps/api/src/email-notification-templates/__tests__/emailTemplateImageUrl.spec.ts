import { EMAIL_TEMPLATE_NODE_TYPES } from "@repo/shared";

import { EMAIL_TEMPLATE_IMAGE_PUBLIC_PATH } from "../email-template-image.constants";
import {
  collectImageSrcs,
  extractFileKeyFromImageUrl,
  extractTenantEmailTemplateImageFileKeyFromUrl,
  isEmailTemplateImageFileKeyForTenant,
} from "../utils/emailTemplateImageUrl";

import type { EmailTemplateNode } from "@repo/shared";

const imageNode = (src: string): EmailTemplateNode => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.IMAGE,
  attrs: { src },
});
const TENANT_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_TENANT_ID = "99999999-9999-9999-9999-999999999999";

const paraNode = (...children: EmailTemplateNode[]): EmailTemplateNode => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH,
  content: children,
});

const doc = (...children: EmailTemplateNode[]): EmailTemplateNode => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
  content: children,
});

describe("collectImageSrcs", () => {
  it("yields src from a top-level image node", () => {
    const node = imageNode("https://example.com/img.png");
    const srcs = [...collectImageSrcs(node)];
    expect(srcs).toEqual(["https://example.com/img.png"]);
  });

  it("walks nested content to find image nodes", () => {
    const root = doc(paraNode(imageNode("https://example.com/nested.png")));
    const srcs = [...collectImageSrcs(root)];
    expect(srcs).toEqual(["https://example.com/nested.png"]);
  });

  it("yields multiple srcs when multiple image nodes are present", () => {
    const root = doc(imageNode("https://a.com/1.png"), imageNode("https://b.com/2.png"));
    const srcs = [...collectImageSrcs(root)];
    expect(srcs).toHaveLength(2);
    expect(srcs).toContain("https://a.com/1.png");
    expect(srcs).toContain("https://b.com/2.png");
  });

  it("skips image nodes with non-string src", () => {
    const node: EmailTemplateNode = {
      type: EMAIL_TEMPLATE_NODE_TYPES.IMAGE,
      attrs: { src: null },
    };
    const srcs = [...collectImageSrcs(node)];
    expect(srcs).toHaveLength(0);
  });

  it("skips non-image nodes", () => {
    const node = paraNode({ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text: "hello" });
    const srcs = [...collectImageSrcs(node)];
    expect(srcs).toHaveLength(0);
  });

  it("returns empty for a node with no content", () => {
    const node: EmailTemplateNode = { type: EMAIL_TEMPLATE_NODE_TYPES.DOC };
    const srcs = [...collectImageSrcs(node)];
    expect(srcs).toHaveLength(0);
  });
});

describe("extractFileKeyFromImageUrl", () => {
  it("returns null when EMAIL_TEMPLATE_IMAGE_PUBLIC_PATH is not present", () => {
    const result = extractFileKeyFromImageUrl("https://example.com/other/path/image.png");
    expect(result).toBeNull();
  });

  it("extracts the key after EMAIL_TEMPLATE_IMAGE_PUBLIC_PATH", () => {
    const key = "tenant-id/email_template_image/variants/abc.webp";
    const url = `https://example.com${EMAIL_TEMPLATE_IMAGE_PUBLIC_PATH}${key}`;
    const result = extractFileKeyFromImageUrl(url);
    expect(result).toBe(key);
  });

  it("decodes URI-encoded characters in the key", () => {
    const rawKey = "tenant/email_template_image/variants/image with spaces.webp";
    const encodedKey = encodeURIComponent(rawKey);
    const url = `https://example.com${EMAIL_TEMPLATE_IMAGE_PUBLIC_PATH}${encodedKey}`;
    const result = extractFileKeyFromImageUrl(url);
    expect(result).toBe(rawKey);
  });

  it("returns null when the URL contains malformed URI encoding", () => {
    const result = extractFileKeyFromImageUrl(
      `https://example.com${EMAIL_TEMPLATE_IMAGE_PUBLIC_PATH}%E0%A4%A`,
    );
    expect(result).toBeNull();
  });
});

describe("isEmailTemplateImageFileKeyForTenant", () => {
  it("accepts keys inside the current tenant email template image category", () => {
    const key = `${TENANT_ID}/email_template_image/variants/abc.webp`;
    expect(isEmailTemplateImageFileKeyForTenant(key, TENANT_ID)).toBe(true);
  });

  it("rejects keys from a different tenant", () => {
    const key = `${OTHER_TENANT_ID}/email_template_image/variants/abc.webp`;
    expect(isEmailTemplateImageFileKeyForTenant(key, TENANT_ID)).toBe(false);
  });

  it("rejects keys from a different category", () => {
    const key = `${TENANT_ID}/course/variants/abc.webp`;
    expect(isEmailTemplateImageFileKeyForTenant(key, TENANT_ID)).toBe(false);
  });
});

describe("extractTenantEmailTemplateImageFileKeyFromUrl", () => {
  it("extracts a safe key for the current tenant email template image category", () => {
    const key = `${TENANT_ID}/email_template_image/variants/abc.webp`;
    const url = `https://example.com${EMAIL_TEMPLATE_IMAGE_PUBLIC_PATH}${encodeURIComponent(key)}`;
    const result = extractTenantEmailTemplateImageFileKeyFromUrl(url, TENANT_ID);
    expect(result).toBe(key);
  });

  it("returns null for a crafted URL pointing at another category key", () => {
    const key = `${TENANT_ID}/course/variants/abc.webp`;
    const url = `https://external.test${EMAIL_TEMPLATE_IMAGE_PUBLIC_PATH}${encodeURIComponent(
      key,
    )}`;
    const result = extractTenantEmailTemplateImageFileKeyFromUrl(url, TENANT_ID);
    expect(result).toBeNull();
  });
});
