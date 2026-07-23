import { EMAIL_TEMPLATE_NODE_TYPES, EMAIL_TEMPLATE_NODE_UUID_ATTR } from "@repo/shared";

import { pruneOrphanStrings } from "../utils/pruneOrphanStrings";

import type { EmailTemplateBlocks, EmailTemplateStrings } from "@repo/shared";

const uuid1 = "aaaaaaaa-0000-4000-8000-000000000001";
const uuid2 = "aaaaaaaa-0000-4000-8000-000000000002";
const uuid3 = "aaaaaaaa-0000-4000-8000-000000000003";

const textNode = (text: string) => ({ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text });

const doc = (...children: EmailTemplateBlocks[]): EmailTemplateBlocks => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
  content: children,
});

const para = (uuid: string): EmailTemplateBlocks => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH,
  attrs: { [EMAIL_TEMPLATE_NODE_UUID_ATTR]: uuid },
  content: [textNode("text")],
});

const EN = "en" as const;
const PL = "pl" as const;

describe("pruneOrphanStrings", () => {
  it("removes uuids not present in blocks", () => {
    const blocks = doc(para(uuid1));
    const strings: EmailTemplateStrings = {
      [EN]: {
        [uuid1]: [textNode("keep")],
        [uuid2]: [textNode("orphan")],
      },
    };

    const result = pruneOrphanStrings(blocks, strings);

    expect(result[EN]).toBeDefined();
    expect(result[EN]![uuid1]).toBeDefined();
    expect(result[EN]![uuid2]).toBeUndefined();
  });

  it("keeps uuids that are present in blocks", () => {
    const blocks = doc(para(uuid1), para(uuid2));
    const strings: EmailTemplateStrings = {
      [EN]: {
        [uuid1]: [textNode("one")],
        [uuid2]: [textNode("two")],
      },
    };

    const result = pruneOrphanStrings(blocks, strings);

    expect(result[EN]![uuid1]).toBeDefined();
    expect(result[EN]![uuid2]).toBeDefined();
  });

  it("drops language buckets that become empty", () => {
    const blocks = doc(para(uuid1));
    const strings: EmailTemplateStrings = {
      [EN]: { [uuid1]: [textNode("keep")] },
      [PL]: { [uuid3]: [textNode("orphan")] },
    };

    const result = pruneOrphanStrings(blocks, strings);

    expect(result[EN]).toBeDefined();
    expect(result[PL]).toBeUndefined();
  });

  it("handles undefined byUuid entries gracefully", () => {
    const blocks = doc(para(uuid1));
    const strings = {
      [EN]: undefined,
    } as unknown as EmailTemplateStrings;

    expect(() => pruneOrphanStrings(blocks, strings)).not.toThrow();
    const result = pruneOrphanStrings(blocks, strings);
    expect(result[EN]).toBeUndefined();
  });

  it("returns empty strings when no uuids in blocks match", () => {
    const blocks = doc({ type: EMAIL_TEMPLATE_NODE_TYPES.DOC });
    const strings: EmailTemplateStrings = {
      [EN]: { [uuid1]: [textNode("orphan")] },
    };

    const result = pruneOrphanStrings(blocks, strings);

    expect(Object.keys(result)).toHaveLength(0);
  });
});
