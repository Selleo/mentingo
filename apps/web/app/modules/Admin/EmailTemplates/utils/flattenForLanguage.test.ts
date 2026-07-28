import { EMAIL_TEMPLATE_NODE_TYPES, EMAIL_TEMPLATE_NODE_UUID_ATTR } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { BUTTON_FALLBACK_ATTR, flattenForLanguage } from "./flattenForLanguage";

import type { EmailTemplateBlocks, EmailTemplateStrings } from "@repo/shared";

const uuid1 = "aaaaaaaa-0000-4000-8000-000000000001";
const uuid2 = "aaaaaaaa-0000-4000-8000-000000000002";

const textNode = (text: string) => ({ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text });

const para = (uuid: string, ...children: ReturnType<typeof textNode>[]): EmailTemplateBlocks => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH,
  attrs: { [EMAIL_TEMPLATE_NODE_UUID_ATTR]: uuid },
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

const EN = "en" as const;
const PL = "pl" as const;

describe("flattenForLanguage", () => {
  it("overlays content for a non-BUTTON node from the target language", () => {
    const plFragment = [textNode("PL text")];
    const blocks = doc(para(uuid1, textNode("EN text")));
    const strings: EmailTemplateStrings = { [PL]: { [uuid1]: plFragment } };

    const result = flattenForLanguage({ blocks, strings, language: PL, baseLanguage: EN });

    expect(result.content?.[0]?.content).toEqual(plFragment);
  });

  it("sets attrs.text from flattened fragment for BUTTON nodes", () => {
    const plFragment = [textNode("PL button")];
    const blocks = doc(btn(uuid1, "EN button"));
    const strings: EmailTemplateStrings = { [PL]: { [uuid1]: plFragment } };

    const result = flattenForLanguage({ blocks, strings, language: PL, baseLanguage: EN });

    expect(result.content?.[0]?.attrs?.text).toBe("PL button");
    expect(result.content?.[0]?.attrs?.[BUTTON_FALLBACK_ATTR]).toBeUndefined();
  });

  it("clears content for non-base paragraph when target locale has no override", () => {
    const blocks = doc(para(uuid1, textNode("EN text")));
    const strings: EmailTemplateStrings = {};

    const result = flattenForLanguage({ blocks, strings, language: PL, baseLanguage: EN });

    expect(result.content?.[0]?.content).toEqual([]);
  });

  it("clears content for non-base paragraph when target locale override is empty", () => {
    const blocks = doc(para(uuid1, textNode("EN text")));
    const strings: EmailTemplateStrings = { [PL]: { [uuid1]: [] } };

    const result = flattenForLanguage({ blocks, strings, language: PL, baseLanguage: EN });

    expect(result.content?.[0]?.content).toEqual([]);
  });

  it("marks BUTTON node with fallback attribute when non-base locale override is missing", () => {
    const blocks = doc(btn(uuid1, "EN button"));
    const strings: EmailTemplateStrings = {};

    const result = flattenForLanguage({ blocks, strings, language: PL, baseLanguage: EN });

    expect(result.content?.[0]?.attrs?.text).toBe("EN button");
    expect(result.content?.[0]?.attrs?.[BUTTON_FALLBACK_ATTR]).toBe("true");
  });

  it("does NOT mark BUTTON with fallback attribute when base text itself is empty", () => {
    const blocks = doc(btn(uuid1, ""));
    const strings: EmailTemplateStrings = {};

    const result = flattenForLanguage({ blocks, strings, language: PL, baseLanguage: EN });

    expect(result.content?.[0]?.attrs?.[BUTTON_FALLBACK_ATTR]).toBeUndefined();
  });

  it("leaves node untouched for base language even when strings are missing", () => {
    const originalContent = [textNode("original")];
    const blocks = doc(para(uuid1, ...originalContent));
    const strings: EmailTemplateStrings = {};

    const result = flattenForLanguage({ blocks, strings, language: EN, baseLanguage: EN });

    expect(result.content?.[0]?.content).toEqual(originalContent);
  });

  it("does not mutate the original blocks argument", () => {
    const blocks = doc(para(uuid1, textNode("original")));
    const strings: EmailTemplateStrings = {
      [PL]: { [uuid1]: [textNode("PL text")] },
    };
    const snapshot = JSON.stringify(blocks);

    flattenForLanguage({ blocks, strings, language: PL, baseLanguage: EN });

    expect(JSON.stringify(blocks)).toBe(snapshot);
  });

  it("handles multiple nodes independently for non-base language", () => {
    const plFrag2 = [textNode("PL 2")];
    const blocks = doc(para(uuid1, textNode("a")), para(uuid2, textNode("b")));
    const strings: EmailTemplateStrings = {
      [PL]: { [uuid2]: plFrag2 },
    };

    const result = flattenForLanguage({ blocks, strings, language: PL, baseLanguage: EN });

    expect(result.content?.[0]?.content).toEqual([]);
    expect(result.content?.[1]?.content).toEqual(plFrag2);
  });
});
