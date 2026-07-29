import { BadRequestException } from "@nestjs/common";
import { TENANT_LOGO_VARIABLE } from "@repo/shared";

import { assertSafeBlockUrls } from "../utils/assertSafeBlockUrls";

import type { EmailTemplateBlocks } from "@repo/shared";

const doc = (content: EmailTemplateBlocks["content"]): EmailTemplateBlocks => ({
  type: "doc",
  content,
});

const image = (src: string): EmailTemplateBlocks => ({
  type: "image",
  attrs: { src },
});

const button = (url: string): EmailTemplateBlocks => ({
  type: "button",
  attrs: { url },
});

const textWithLink = (href: string): EmailTemplateBlocks => ({
  type: "text",
  text: "click",
  marks: [{ type: "link", attrs: { href } }],
});

describe("assertSafeBlockUrls", () => {
  it("allows http: image src", () => {
    expect(() => assertSafeBlockUrls(doc([image("http://example.com/img.png")]))).not.toThrow();
  });

  it("allows https: image src", () => {
    expect(() =>
      assertSafeBlockUrls(doc([image("https://cdn.example.com/img.webp")])),
    ).not.toThrow();
  });

  it("allows mailto: link href", () => {
    expect(() => assertSafeBlockUrls(doc([textWithLink("mailto:user@example.com")]))).not.toThrow();
  });

  it("allows relative image src starting with /", () => {
    expect(() =>
      assertSafeBlockUrls(doc([image("/api/public/email-template-image/key.webp")])),
    ).not.toThrow();
  });

  it("rejects javascript: image src", () => {
    expect(() => assertSafeBlockUrls(doc([image("javascript:alert(1)")]))).toThrow(
      new BadRequestException("emailTemplates.toast.invalidUrl"),
    );
  });

  it("rejects data: image src", () => {
    expect(() => assertSafeBlockUrls(doc([image("data:image/png;base64,abc")]))).toThrow(
      new BadRequestException("emailTemplates.toast.invalidUrl"),
    );
  });

  it("rejects vbscript: link href", () => {
    expect(() => assertSafeBlockUrls(doc([textWithLink("vbscript:msgbox(1)")]))).toThrow(
      new BadRequestException("emailTemplates.toast.invalidUrl"),
    );
  });

  it("rejects non-slash relative src", () => {
    expect(() => assertSafeBlockUrls(doc([image("foo/bar.png")]))).toThrow(
      new BadRequestException("emailTemplates.toast.invalidUrl"),
    );
  });

  it("allows button with safe https: url", () => {
    expect(() => assertSafeBlockUrls(doc([button("https://example.com")]))).not.toThrow();
  });

  it("rejects button with javascript: url", () => {
    expect(() => assertSafeBlockUrls(doc([button("javascript:alert(1)")]))).toThrow(
      new BadRequestException("emailTemplates.toast.invalidUrl"),
    );
  });

  it("allows the tenant logo placeholder as image src", () => {
    expect(() => assertSafeBlockUrls(doc([image(TENANT_LOGO_VARIABLE)]))).not.toThrow();
  });

  it("rejects arbitrary template placeholders in image src", () => {
    expect(() => assertSafeBlockUrls(doc([image("{{user.avatar_url}}")]))).toThrow(
      new BadRequestException("emailTemplates.toast.invalidUrl"),
    );
  });
});
