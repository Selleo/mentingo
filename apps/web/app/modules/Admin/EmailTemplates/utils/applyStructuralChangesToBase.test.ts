import { EMAIL_TEMPLATE_NODE_TYPES, EMAIL_TEMPLATE_NODE_UUID_ATTR } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { applyStructuralChangesToBase } from "./applyStructuralChangesToBase";

import type { EmailTemplateBlocks } from "@repo/shared";

const uuid1 = "aaaaaaaa-0000-4000-8000-000000000001";
const uuid2 = "aaaaaaaa-0000-4000-8000-000000000002";

const textNode = (text: string) => ({ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text });

const para = (uuid: string, ...children: ReturnType<typeof textNode>[]): EmailTemplateBlocks => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH,
  attrs: { [EMAIL_TEMPLATE_NODE_UUID_ATTR]: uuid, extraAttr: "preserved" },
  content: children,
});

const btn = (uuid: string, text: string, url = "https://example.com"): EmailTemplateBlocks => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.BUTTON,
  attrs: { [EMAIL_TEMPLATE_NODE_UUID_ATTR]: uuid, text, url },
});

const doc = (...children: EmailTemplateBlocks[]): EmailTemplateBlocks => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
  content: children,
});

describe("applyStructuralChangesToBase", () => {
  it("restores content from base for a matching non-BUTTON translatable node", () => {
    const base = doc(para(uuid1, textNode("base text")));
    const translated = doc(para(uuid1, textNode("translated text")));

    const result = applyStructuralChangesToBase(translated, base);

    expect(result.content?.[0]?.content).toEqual([textNode("base text")]);
  });

  it("preserves other attrs when restoring content for a non-BUTTON node", () => {
    const base = doc(para(uuid1, textNode("base")));
    const translated = doc({
      ...para(uuid1, textNode("translated")),
      attrs: { [EMAIL_TEMPLATE_NODE_UUID_ATTR]: uuid1, extraAttr: "preserved" },
    });

    const result = applyStructuralChangesToBase(translated, base);

    expect(result.content?.[0]?.attrs?.extraAttr).toBe("preserved");
  });

  it("restores attrs.text from base for BUTTON nodes", () => {
    const base = doc(btn(uuid1, "Base button text"));
    const changed = doc(btn(uuid1, "Changed text"));

    const result = applyStructuralChangesToBase(changed, base);

    expect(result.content?.[0]?.attrs?.text).toBe("Base button text");
  });

  it("preserves other attrs on BUTTON when restoring text", () => {
    const base = doc(btn(uuid1, "Base", "https://original.com"));
    const changed = doc({
      type: EMAIL_TEMPLATE_NODE_TYPES.BUTTON,
      attrs: {
        [EMAIL_TEMPLATE_NODE_UUID_ATTR]: uuid1,
        text: "Changed",
        url: "https://new.com",
      },
    });

    const result = applyStructuralChangesToBase(changed, base);

    expect(result.content?.[0]?.attrs?.url).toBe("https://new.com");
    expect(result.content?.[0]?.attrs?.text).toBe("Base");
  });

  it("passes through nodes without a matching uuid in base", () => {
    const base = doc(para(uuid1, textNode("base")));
    const changed = doc(para(uuid1, textNode("base")), para(uuid2, textNode("new node")));

    const result = applyStructuralChangesToBase(changed, base);

    expect(result.content?.[1]?.content).toEqual([textNode("new node")]);
  });

  it("recurses into non-translatable nodes", () => {
    const innerPara = para(uuid1, textNode("base inner"));
    const section: EmailTemplateBlocks = {
      type: EMAIL_TEMPLATE_NODE_TYPES.SECTION,
      content: [innerPara],
    };
    const baseDoc = doc(section);

    const changedInner = para(uuid1, textNode("changed inner"));
    const changedSection: EmailTemplateBlocks = {
      type: EMAIL_TEMPLATE_NODE_TYPES.SECTION,
      content: [changedInner],
    };
    const changedDoc = doc(changedSection);

    const result = applyStructuralChangesToBase(changedDoc, baseDoc);

    expect(result.content?.[0]?.content?.[0]?.content).toEqual([textNode("base inner")]);
  });

  it("does not mutate the doc argument", () => {
    const base = doc(para(uuid1, textNode("base")));
    const changed = doc(para(uuid1, textNode("changed")));
    const snapshot = JSON.stringify(changed);

    applyStructuralChangesToBase(changed, base);

    expect(JSON.stringify(changed)).toBe(snapshot);
  });

  it("does not mutate the base argument", () => {
    const base = doc(para(uuid1, textNode("base")));
    const changed = doc(para(uuid1, textNode("changed")));
    const snapshot = JSON.stringify(base);

    applyStructuralChangesToBase(changed, base);

    expect(JSON.stringify(base)).toBe(snapshot);
  });
});
