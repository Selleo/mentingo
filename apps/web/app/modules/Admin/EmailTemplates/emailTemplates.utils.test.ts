import { describe, expect, it } from "vitest";

import { EMAIL_TEMPLATE_BLOCK_OPTIONS } from "./emailTemplates.constants";
import {
  createEmailTemplateBlock,
  isEmailTemplateTranslationComplete,
  moveEmailTemplateBlock,
  moveEmailTemplateBlockToInsertion,
  serializeEmailTemplateParagraphs,
} from "./emailTemplates.utils";

import type { EmailTemplateFormValues } from "./emailTemplates.types";

describe("email template editing", () => {
  it("moves blocks to drop positions before and after their original position", () => {
    const blocks = [
      createEmailTemplateBlock("header"),
      createEmailTemplateBlock("text"),
      createEmailTemplateBlock("footer"),
    ];
    expect(moveEmailTemplateBlockToInsertion(blocks, 0, 3)).toEqual([
      blocks[1],
      blocks[2],
      blocks[0],
    ]);
    expect(moveEmailTemplateBlockToInsertion(blocks, 2, 0)).toEqual([
      blocks[2],
      blocks[0],
      blocks[1],
    ]);
    expect(moveEmailTemplateBlockToInsertion(blocks, 1, 2)).toBe(blocks);
    expect(moveEmailTemplateBlockToInsertion(blocks, -1, 1)).toBe(blocks);
    expect(moveEmailTemplateBlockToInsertion(blocks, 0, 4)).toBe(blocks);
    expect(blocks[0].type).toBe("header");
  });
  it.each(EMAIL_TEMPLATE_BLOCK_OPTIONS)("creates a supported %s block", (type) => {
    expect(createEmailTemplateBlock(type).type).toBe(type);
  });

  it("moves blocks without mutating the original document", () => {
    const blocks = [
      createEmailTemplateBlock("header"),
      createEmailTemplateBlock("text"),
      createEmailTemplateBlock("footer"),
    ];
    expect(moveEmailTemplateBlock(blocks, 1, -1).map((block) => block.type)).toEqual([
      "text",
      "header",
      "footer",
    ]);
    expect(blocks.map((block) => block.type)).toEqual(["header", "text", "footer"]);
    expect(moveEmailTemplateBlock(blocks, 0, -1)).toBe(blocks);
    expect(moveEmailTemplateBlock(blocks, 2, 1)).toBe(blocks);
  });

  it("strips Tiptap-only attributes and unsupported marks before saving", () => {
    expect(
      serializeEmailTemplateParagraphs({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Open {{ courses_link }}",
                marks: [
                  {
                    type: "link",
                    attrs: { href: "{{ courses_link }}", rel: "noopener", target: "_blank" },
                  },
                  { type: "bold" },
                  { type: "code" },
                ],
              },
            ],
          },
        ],
      }),
    ).toEqual([
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Open {{ courses_link }}",
            marks: [{ type: "link", attrs: { href: "{{ courses_link }}" } }, { type: "bold" }],
          },
        ],
      },
    ]);
  });

  it("requires a localized name, subject and meaningful body for base-language changes", () => {
    const values: EmailTemplateFormValues = {
      name: { en: "Welcome", pl: "Powitanie" },
      subject: { en: "Hello", pl: "Cześć" },
      content: {
        en: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "text",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
            },
          ],
        },
      },
    };
    expect(isEmailTemplateTranslationComplete(values, "en")).toBe(true);
    expect(isEmailTemplateTranslationComplete(values, "pl")).toBe(false);
    expect(isEmailTemplateTranslationComplete({ ...values, name: { en: " " } }, "en")).toBe(false);
    expect(
      isEmailTemplateTranslationComplete(
        {
          ...values,
          content: {
            en: { type: "doc", version: 1, content: [createEmailTemplateBlock("footer")] },
          },
        },
        "en",
      ),
    ).toBe(false);
  });
});
