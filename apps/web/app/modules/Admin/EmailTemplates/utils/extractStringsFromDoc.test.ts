import { EMAIL_TEMPLATE_NODE_TYPES, EMAIL_TEMPLATE_NODE_UUID_ATTR } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { extractStringsFromDoc } from "./extractStringsFromDoc";

import type { EmailTemplateBlocks } from "@repo/shared";

const uuid1 = "aaaaaaaa-0000-4000-8000-000000000001";
const uuid2 = "aaaaaaaa-0000-4000-8000-000000000002";

const textNode = (text: string) => ({ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text });

const para = (uuid: string, ...children: ReturnType<typeof textNode>[]): EmailTemplateBlocks => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH,
  attrs: { [EMAIL_TEMPLATE_NODE_UUID_ATTR]: uuid },
  content: children,
});

const btn = (uuid: string, text: string): EmailTemplateBlocks => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.BUTTON,
  attrs: { [EMAIL_TEMPLATE_NODE_UUID_ATTR]: uuid, text, url: "https://example.com" },
});

const doc = (...children: EmailTemplateBlocks[]): EmailTemplateBlocks => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
  content: children,
});

describe("extractStringsFromDoc", () => {
  it("extracts content array for a non-BUTTON translatable node", () => {
    const content = [textNode("hello")];
    const document = doc({ ...para(uuid1), content });

    const result = extractStringsFromDoc(document);

    expect(result[uuid1]).toEqual(content);
  });

  it("extracts button attrs.text as a single-item fragment", () => {
    const document = doc(btn(uuid1, "Click me"));

    const result = extractStringsFromDoc(document);

    expect(result[uuid1]).toEqual([{ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text: "Click me" }]);
  });

  it("produces an empty fragment for a button with empty text", () => {
    const document = doc(btn(uuid1, ""));

    const result = extractStringsFromDoc(document);

    expect(result[uuid1]).toEqual([]);
  });

  it("skips nodes without a string uuid", () => {
    const nodeWithoutUuid: EmailTemplateBlocks = {
      type: EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH,
      attrs: {},
      content: [textNode("no uuid")],
    };
    const document = doc(nodeWithoutUuid);

    const result = extractStringsFromDoc(document);

    expect(Object.keys(result)).toHaveLength(0);
  });

  it("walks but does not record non-translatable structural nodes", () => {
    const section: EmailTemplateBlocks = {
      type: EMAIL_TEMPLATE_NODE_TYPES.SECTION,
      content: [para(uuid1, textNode("inside section"))],
    };
    const document = doc(section);

    const result = extractStringsFromDoc(document);

    expect(Object.keys(result)).toContain(uuid1);
    expect(Object.keys(result)).not.toContain("section-uuid");
  });

  it("records multiple translatable nodes by their uuids", () => {
    const document = doc(para(uuid1, textNode("first")), para(uuid2, textNode("second")));

    const result = extractStringsFromDoc(document);

    expect(result[uuid1]).toEqual([textNode("first")]);
    expect(result[uuid2]).toEqual([textNode("second")]);
  });
});
