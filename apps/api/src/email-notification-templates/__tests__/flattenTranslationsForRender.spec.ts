import { EMAIL_TEMPLATE_NODE_TYPES, EMAIL_TEMPLATE_NODE_UUID_ATTR } from "@repo/shared";

import { flattenTranslationsForRender } from "../utils/flattenTranslationsForRender";

import type { EmailTemplateBlocks, EmailTemplateStrings } from "@repo/shared";

const uuid1 = "aaaaaaaa-0000-4000-8000-000000000001";
const uuid2 = "aaaaaaaa-0000-4000-8000-000000000002";

const textNode = (text: string) => ({ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text });

const para = (uuid: string, ...textNodes: ReturnType<typeof textNode>[]): EmailTemplateBlocks => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH,
  attrs: { [EMAIL_TEMPLATE_NODE_UUID_ATTR]: uuid },
  content: textNodes,
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

describe("flattenTranslationsForRender", () => {
  it("replaces content of a non-BUTTON translatable node with the fragment", () => {
    const fragment = [textNode("Polish paragraph")];
    const blocks = doc(para(uuid1, textNode("English paragraph")));
    const strings: EmailTemplateStrings = { [PL]: { [uuid1]: fragment } };

    const result = flattenTranslationsForRender({
      blocks,
      strings,
      language: PL,
      baseLanguage: EN,
    });

    const firstChild = result.content?.[0];
    expect(firstChild?.content).toEqual(fragment);
  });

  it("sets attrs.text from flattened fragment text for BUTTON nodes", () => {
    const fragment = [textNode("Buy now")];
    const blocks = doc(btn(uuid1, "Click"));
    const strings: EmailTemplateStrings = { [PL]: { [uuid1]: fragment } };

    const result = flattenTranslationsForRender({
      blocks,
      strings,
      language: PL,
      baseLanguage: EN,
    });

    expect(result.content?.[0]?.attrs?.text).toBe("Buy now");
  });

  it("flattens nested content in a BUTTON fragment", () => {
    const fragment = [{ type: "paragraph", content: [textNode("nested text")] }];
    const blocks = doc(btn(uuid1, "old"));
    const strings: EmailTemplateStrings = { [PL]: { [uuid1]: fragment } };

    const result = flattenTranslationsForRender({
      blocks,
      strings,
      language: PL,
      baseLanguage: EN,
    });

    expect(result.content?.[0]?.attrs?.text).toBe("nested text");
  });

  it("falls back to baseLanguage fragment when target language fragment is missing", () => {
    const enFragment = [textNode("English text")];
    const blocks = doc(para(uuid1, textNode("original")));
    const strings: EmailTemplateStrings = { [EN]: { [uuid1]: enFragment } };

    const result = flattenTranslationsForRender({
      blocks,
      strings,
      language: PL,
      baseLanguage: EN,
    });

    expect(result.content?.[0]?.content).toEqual(enFragment);
  });

  it("falls back to baseLanguage fragment when target language fragment is empty", () => {
    const enFragment = [textNode("English text")];
    const blocks = doc(para(uuid1, textNode("original")));
    const strings: EmailTemplateStrings = {
      [EN]: { [uuid1]: enFragment },
      [PL]: { [uuid1]: [] },
    };

    const result = flattenTranslationsForRender({
      blocks,
      strings,
      language: PL,
      baseLanguage: EN,
    });

    expect(result.content?.[0]?.content).toEqual(enFragment);
  });

  it("falls back to baseLanguage fragment when target fragment contains only whitespace", () => {
    const enFragment = [textNode("English text")];
    const blocks = doc(para(uuid1, textNode("original")));
    const strings: EmailTemplateStrings = {
      [EN]: { [uuid1]: enFragment },
      [PL]: { [uuid1]: [textNode("   ")] },
    };

    const result = flattenTranslationsForRender({
      blocks,
      strings,
      language: PL,
      baseLanguage: EN,
    });

    expect(result.content?.[0]?.content).toEqual(enFragment);
  });

  it("falls back to baseLanguage button text when target text is empty", () => {
    const blocks = doc(btn(uuid1, "original"));
    const strings: EmailTemplateStrings = {
      [EN]: { [uuid1]: [textNode("Buy now")] },
      [PL]: { [uuid1]: [] },
    };

    const result = flattenTranslationsForRender({
      blocks,
      strings,
      language: PL,
      baseLanguage: EN,
    });

    expect(result.content?.[0]?.attrs?.text).toBe("Buy now");
  });

  it("leaves node untouched when both target and base language fragments are missing", () => {
    const originalContent = [textNode("original")];
    const blocks = doc(para(uuid1, ...originalContent));
    const strings: EmailTemplateStrings = {};

    const result = flattenTranslationsForRender({
      blocks,
      strings,
      language: PL,
      baseLanguage: EN,
    });

    expect(result.content?.[0]?.content).toEqual(originalContent);
  });

  it("does not mutate the original blocks argument", () => {
    const enFragment = [textNode("EN text")];
    const blocks = doc(para(uuid1, textNode("original")));
    const strings: EmailTemplateStrings = { [EN]: { [uuid1]: enFragment } };

    const blocksBefore = JSON.stringify(blocks);
    flattenTranslationsForRender({ blocks, strings, language: EN, baseLanguage: EN });

    expect(JSON.stringify(blocks)).toBe(blocksBefore);
  });

  it("handles multiple nodes with different uuids independently", () => {
    const enFrag1 = [textNode("EN para 1")];
    const enFrag2 = [textNode("EN para 2")];
    const plFrag2 = [textNode("PL para 2")];
    const blocks = doc(para(uuid1, textNode("a")), para(uuid2, textNode("b")));
    const strings: EmailTemplateStrings = {
      [EN]: { [uuid1]: enFrag1, [uuid2]: enFrag2 },
      [PL]: { [uuid2]: plFrag2 },
    };

    const result = flattenTranslationsForRender({
      blocks,
      strings,
      language: PL,
      baseLanguage: EN,
    });

    expect(result.content?.[0]?.content).toEqual(enFrag1);
    expect(result.content?.[1]?.content).toEqual(plFrag2);
  });
});
