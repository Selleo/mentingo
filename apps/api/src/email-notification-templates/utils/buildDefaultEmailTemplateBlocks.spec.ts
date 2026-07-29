import {
  EMAIL_TEMPLATE_NODE_TYPES,
  EMAIL_TEMPLATE_NODE_UUID_ATTR,
  SUPPORTED_LANGUAGES,
  TENANT_LOGO_VARIABLE,
} from "@repo/shared";

import { buildDefaultEmailTemplateBlocks } from "./buildDefaultEmailTemplateBlocks";

describe("buildDefaultEmailTemplateBlocks", () => {
  it("starts new English templates with logo, heading 2, paragraph, button, divider, and footer", () => {
    const blocks = buildDefaultEmailTemplateBlocks();
    const content = blocks.content ?? [];

    expect(blocks.type).toBe(EMAIL_TEMPLATE_NODE_TYPES.DOC);
    expect(content.map((node) => node.type)).toEqual([
      EMAIL_TEMPLATE_NODE_TYPES.IMAGE,
      EMAIL_TEMPLATE_NODE_TYPES.HEADING,
      EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH,
      EMAIL_TEMPLATE_NODE_TYPES.BUTTON,
      EMAIL_TEMPLATE_NODE_TYPES.HORIZONTAL_RULE,
      EMAIL_TEMPLATE_NODE_TYPES.FOOTER,
    ]);

    expect(content[0]?.attrs).toMatchObject({
      src: TENANT_LOGO_VARIABLE,
      alignment: "center",
      width: null,
      height: "32",
    });
    expect(content[1]?.attrs?.level).toBe(2);
    expect(content[1]?.content?.[0]?.text).toBe("Heading 2");
    expect(content[2]?.content?.[0]?.text).toBe("Paragraph text");
    expect(content[3]?.attrs).toMatchObject({
      text: "Button",
      url: "",
      alignment: "left",
      variant: "filled",
      borderRadius: "smooth",
    });
    expect(content[5]?.content?.[0]?.text).toBe("Footer text");
  });

  it("uses the selected base language for placeholder text", () => {
    const blocks = buildDefaultEmailTemplateBlocks(SUPPORTED_LANGUAGES.PL);
    const content = blocks.content ?? [];

    expect(content[1]?.content?.[0]?.text).toBe("Nagłówek 2");
    expect(content[2]?.content?.[0]?.text).toBe("Tekst akapitu");
    expect(content[3]?.attrs?.text).toBe("Przycisk");
    expect(content[5]?.content?.[0]?.text).toBe("Tekst stopki");
  });

  it("stamps every top-level editable block with a uuid", () => {
    const content = buildDefaultEmailTemplateBlocks().content ?? [];
    const uuids = content.map((node) => node.attrs?.[EMAIL_TEMPLATE_NODE_UUID_ATTR]);

    expect(uuids).toHaveLength(6);
    expect(uuids.every((uuid) => typeof uuid === "string" && uuid.length > 0)).toBe(true);
    expect(new Set(uuids).size).toBe(6);
  });
});
