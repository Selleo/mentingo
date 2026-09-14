import { EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT } from "@repo/email-templates";
import { Value } from "@sinclair/typebox/value";

import { createEmailTemplateSchema } from "./email-template.schema";

describe("Email template request schema", () => {
  const definition = EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT.welcome;
  const valid = {
    event: definition.event,
    name: { en: "Welcome" },
    subject: { en: "Welcome" },
    content: { en: definition.defaultDocuments.en },
  };

  it("accepts partial supported translations and rejects unknown languages", () => {
    expect(Value.Check(createEmailTemplateSchema, valid)).toBe(true);
    expect(Value.Check(createEmailTemplateSchema, { ...valid, name: { xx: "Hello" } })).toBe(false);
  });

  it("rejects arbitrary HTML and unknown block attributes", () => {
    expect(
      Value.Check(createEmailTemplateSchema, {
        ...valid,
        content: {
          en: {
            ...definition.defaultDocuments.en,
            content: [{ type: "html", html: "<script>alert(1)</script>" }],
          },
        },
      }),
    ).toBe(false);
  });

  it("accepts rich footer content", () => {
    expect(
      Value.Check(createEmailTemplateSchema, {
        ...valid,
        content: {
          en: {
            ...definition.defaultDocuments.en,
            content: [
              {
                type: "footer",
                attrs: { text: "" },
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Company", marks: [{ type: "bold" }] }],
                  },
                ],
              },
            ],
          },
        },
      }),
    ).toBe(true);
  });
});
