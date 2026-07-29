import { EMAIL_TEMPLATE_NODE_TYPES, EMAIL_TEMPLATE_NODE_UUID_ATTR } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { swapBaseLanguageContent } from "../swapBaseLanguageContent";

import type { EmailTemplateBlocks, EmailTemplateStrings } from "@repo/shared";

const uuidPara = "aaaaaaaa-0000-4000-8000-000000000001";
const uuidBtn = "aaaaaaaa-0000-4000-8000-000000000002";

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

describe("swapBaseLanguageContent", () => {
  it("moves current blocks content into strings[oldBase] and deletes strings[newBase]", () => {
    const blocks = doc(para(uuidPara, textNode("Hello")));
    const strings: EmailTemplateStrings = {
      pl: { [uuidPara]: [textNode("Cześć")] },
    };

    const result = swapBaseLanguageContent({ blocks, strings, oldBase: "en", newBase: "pl" });

    expect(result.blocks.content?.[0]?.content).toEqual([textNode("Cześć")]);
    expect(result.strings.en?.[uuidPara]).toEqual([textNode("Hello")]);
    expect(result.strings.pl).toBeUndefined();
  });

  it("swaps button attrs.text via strings[newBase]", () => {
    const blocks = doc(btn(uuidBtn, "Buy"));
    const strings: EmailTemplateStrings = {
      pl: { [uuidBtn]: [textNode("Kup")] },
    };

    const result = swapBaseLanguageContent({ blocks, strings, oldBase: "en", newBase: "pl" });

    expect(result.blocks.content?.[0]?.attrs?.text).toBe("Kup");
    expect(result.strings.en?.[uuidBtn]).toEqual([textNode("Buy")]);
    expect(result.strings.pl).toBeUndefined();
  });

  it("keeps blocks content when strings[newBase] does not have the uuid", () => {
    const blocks = doc(para(uuidPara, textNode("Hello")));
    const strings: EmailTemplateStrings = { pl: {} };

    const result = swapBaseLanguageContent({ blocks, strings, oldBase: "en", newBase: "pl" });

    expect(result.blocks.content?.[0]?.content).toEqual([textNode("Hello")]);
    expect(result.strings.en?.[uuidPara]).toEqual([textNode("Hello")]);
    expect(result.strings.pl).toBeUndefined();
  });

  it("preserves other locales untouched", () => {
    const blocks = doc(para(uuidPara, textNode("Hello")));
    const deFrag = [textNode("Hallo")];
    const strings: EmailTemplateStrings = {
      de: { [uuidPara]: deFrag },
      pl: { [uuidPara]: [textNode("Cześć")] },
    };

    const result = swapBaseLanguageContent({ blocks, strings, oldBase: "en", newBase: "pl" });

    expect(result.strings.de?.[uuidPara]).toEqual(deFrag);
  });

  it("does not mutate the original blocks or strings arguments", () => {
    const blocks = doc(para(uuidPara, textNode("Hello")));
    const strings: EmailTemplateStrings = { pl: { [uuidPara]: [textNode("Cześć")] } };
    const blocksBefore = JSON.stringify(blocks);
    const stringsBefore = JSON.stringify(strings);

    swapBaseLanguageContent({ blocks, strings, oldBase: "en", newBase: "pl" });

    expect(JSON.stringify(blocks)).toBe(blocksBefore);
    expect(JSON.stringify(strings)).toBe(stringsBefore);
  });
});
