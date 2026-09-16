import { renderEmailTemplate, type EmailTemplateDocument } from "@repo/email-templates";

import { EmailTemplateValidationService } from "./email-template-validation.service";

describe("Email template variables across formatting boundaries", () => {
  const validation = new EmailTemplateValidationService();

  it.each([
    ["Hello {{ ", "na", "me", " }}!"],
    ["Hello {", "{ name }", "}!"],
    ["{{ name }} and {{ na", "me }}"],
  ])("validates and renders the visible tokens in %j", (...parts: string[]) => {
    const document: EmailTemplateDocument = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "text",
          content: [
            {
              type: "paragraph",
              content: parts.map((text, index) => ({
                type: "text",
                text,
                marks: index % 2 ? [{ type: "bold" }] : [],
              })),
            },
          ],
        },
      ],
    };
    expect(() =>
      validation.validateDraft("user_first_login", { en: "Hello" }, { en: document }),
    ).not.toThrow();
    const result = renderEmailTemplate({
      document,
      subject: "Hello",
      variables: { name: "Ada" },
      branding: { companyName: "Example", primaryColor: "#123456" },
    });
    expect(result.text).toContain(parts.join("").replace(/{{\s*name\s*}}/g, "Ada"));
    expect(result.html).not.toContain("{{");
  });

  it("does not join tokens across paragraph boundaries", () => {
    const document: EmailTemplateDocument = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "text",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "{{ na" }] },
            { type: "paragraph", content: [{ type: "text", text: "me }}" }] },
          ],
        },
      ],
    };
    expect(() =>
      validation.validateDraft("user_first_login", { en: "Hello" }, { en: document }),
    ).toThrow("emailTemplates.errors.malformedVariables");
  });
});
