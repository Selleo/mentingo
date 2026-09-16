import {
  EMAIL_TEMPLATE_BLOCK_TYPES,
  EMAIL_TEMPLATE_DEFINITIONS,
  EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT,
  EMAIL_TEMPLATE_DOCUMENT_VERSION,
  EMAIL_TEMPLATE_EVENTS,
  renderEmailTemplate,
  type EmailTemplateDocument,
} from "@repo/email-templates";
import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { EmailTemplateValidationService } from "./email-template-validation.service";

describe("EmailTemplateValidationService", () => {
  const service = new EmailTemplateValidationService();

  it.each([
    { type: "text", content: [] },
    { type: "heading", content: [{ type: "paragraph", content: [{ type: "text", text: "   " }] }] },
    { type: "footer", attrs: { text: "Old text" }, content: [{ type: "paragraph" }] },
    { type: "button", attrs: { label: "   ", url: "https://example.com" } },
    { type: "image", attrs: { src: "", alt: "" } },
  ])("rejects empty blocks even alongside valid content: %j", (block) => {
    expect(() =>
      service.validateDraft(
        EMAIL_TEMPLATE_EVENTS.WELCOME,
        { en: "Hello" },
        {
          en: {
            type: "doc",
            version: EMAIL_TEMPLATE_DOCUMENT_VERSION,
            content: [
              {
                type: "text",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Valid text" }] }],
              },
              block,
            ],
          } as EmailTemplateDocument,
        },
      ),
    ).toThrow("emailTemplates.errors.invalidContent");
  });

  it.each([
    null,
    { type: "html", version: EMAIL_TEMPLATE_DOCUMENT_VERSION, content: [] },
    { type: "doc", version: 999, content: [] },
    { type: "doc", version: EMAIL_TEMPLATE_DOCUMENT_VERSION, content: {} },
    { type: "doc", version: EMAIL_TEMPLATE_DOCUMENT_VERSION, content: [{ type: "button" }] },
    {
      type: "doc",
      version: EMAIL_TEMPLATE_DOCUMENT_VERSION,
      content: [{ type: "html", html: "<script />" }],
    },
    {
      type: "doc",
      version: EMAIL_TEMPLATE_DOCUMENT_VERSION,
      content: [
        {
          type: "text",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Link", marks: [{ type: "link" }] }],
            },
          ],
        },
      ],
    },
  ])("rejects malformed document structure before traversing it: %j", (document) => {
    expect(() =>
      service.validateDraft(
        EMAIL_TEMPLATE_EVENTS.WELCOME,
        { en: "Hello" },
        { en: document as unknown as EmailTemplateDocument },
      ),
    ).toThrow("emailTemplates.errors.invalidContent");
  });

  it("also validates structure for runtime delivery", () => {
    expect(() =>
      service.validateRuntimeVariables(
        EMAIL_TEMPLATE_EVENTS.WELCOME,
        null as unknown as EmailTemplateDocument,
        service.getSampleVariables(EMAIL_TEMPLATE_EVENTS.WELCOME),
      ),
    ).toThrow("emailTemplates.errors.invalidContent");
  });

  it("still checks inline URLs after structural validation succeeds", () => {
    const document: EmailTemplateDocument = {
      type: "doc",
      version: EMAIL_TEMPLATE_DOCUMENT_VERSION,
      content: [
        {
          type: "text",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Open",
                  marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(() =>
      service.validateDraft(EMAIL_TEMPLATE_EVENTS.WELCOME, { en: "Hello" }, { en: document }),
    ).toThrow("emailTemplates.errors.httpsRequired");
  });

  it.each(["https://localhost./image.png", "https://[::ffff:127.0.0.1]/image.png"])(
    "rejects disguised local image host %s",
    (src) => {
      const document: EmailTemplateDocument = {
        type: "doc",
        version: EMAIL_TEMPLATE_DOCUMENT_VERSION,
        content: [{ type: EMAIL_TEMPLATE_BLOCK_TYPES.IMAGE, attrs: { src, alt: "image" } }],
      };
      expect(() =>
        service.validateDraft(EMAIL_TEMPLATE_EVENTS.WELCOME, { en: "Hi" }, { en: document }),
      ).toThrow("emailTemplates.errors.privateImageHost");
    },
  );

  it("falls back as a whole when the requested body is missing or empty", () => {
    const definition = EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT.welcome;
    const subject = { en: "Hello", pl: "Cześć" };
    expect(
      service.resolveEmailTemplateLanguage(
        subject,
        { en: definition.defaultDocuments.en },
        "pl",
        "en",
      ),
    ).toBe("en");
    expect(
      service.resolveEmailTemplateLanguage(
        subject,
        {
          en: definition.defaultDocuments.en,
          pl: { type: "doc", version: EMAIL_TEMPLATE_DOCUMENT_VERSION, content: [] },
        },
        "pl",
        "en",
      ),
    ).toBe("en");
    expect(
      service.resolveEmailTemplateLanguage(
        { en: "Hello", pl: "" },
        definition.defaultDocuments,
        "pl",
        "en",
      ),
    ).toBe("en");
  });

  it("does not let another translation satisfy the base-language authentication link", () => {
    const definition = EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT.password_recovery;
    const content = {
      ...definition.defaultDocuments,
      en: {
        ...definition.defaultDocuments.en,
        content: definition.defaultDocuments.en.content.filter(
          (block) => block.type !== EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON,
        ),
      },
    };
    expect(() =>
      service.validatePublished(
        definition.event,
        definition.name,
        definition.subjects,
        content,
        "en",
      ),
    ).toThrow("emailTemplates.errors.missingMandatoryVariables");
  });

  it("does not count an authentication variable in image alt text as an action", () => {
    const definition = EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT.password_recovery;
    const document: EmailTemplateDocument = {
      type: "doc",
      version: EMAIL_TEMPLATE_DOCUMENT_VERSION,
      content: [
        {
          type: EMAIL_TEMPLATE_BLOCK_TYPES.IMAGE,
          attrs: {
            src: "https://example.com/image.png",
            alt: "{{ reset_link }}",
          },
        },
      ],
    };
    expect(() =>
      service.validatePublished(
        definition.event,
        definition.name,
        { en: "Reset" },
        { en: document },
        "en",
      ),
    ).toThrow("emailTemplates.errors.missingMandatoryVariables");
  });

  it("warns about missing header and footer", () => {
    expect(
      service.getTranslationWarnings(
        { en: "Hello" },
        {
          en: {
            type: "doc",
            version: EMAIL_TEMPLATE_DOCUMENT_VERSION,
            content: [],
          },
        },
        "en",
      ),
    ).toEqual(
      expect.arrayContaining([
        "emailTemplates.warnings.missingHeader",
        "emailTemplates.warnings.missingFooter",
      ]),
    );
  });

  it("renders every overdue course and uses the tenant company name", () => {
    const definition = EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT.admin_overdue_courses;
    const rendered = renderEmailTemplate({
      subject: definition.subjects.en,
      document: definition.defaultDocuments.en,
      variables: {
        ...service.getSampleVariables(definition.event),
        courses: [
          {
            courseTitle: "First course",
            groups: [
              {
                groupName: "First group",
                dueDate: "2026-09-01",
                students: [
                  { name: "Alex", email: "alex@example.com" },
                  { name: "Sam", email: "sam@example.com" },
                ],
              },
            ],
          },
          {
            courseTitle: "Second course",
            groups: [
              {
                groupName: "Second group",
                dueDate: "2026-09-02",
                students: [{ name: "Jo", email: "jo@example.com" }],
              },
            ],
          },
        ],
      },
      branding: {
        companyName: "Acme",
        primaryColor: "#4796FD",
        logoUrl: "https://example.com/logo.png",
      },
    });
    for (const value of [
      "First course",
      "Second course",
      "First group",
      "Second group",
      "Alex",
      "Sam",
      "Jo",
      "Acme",
    ]) {
      expect(rendered.text).toContain(value);
    }
    expect(rendered.html).not.toContain("{{");
    expect(rendered.html).not.toContain("cid:logo");
  });

  it("accepts an unchanged code-defined default", () => {
    const definition = EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT.user_assigned_to_course;

    expect(() =>
      service.validatePublished(
        definition.event,
        definition.name,
        definition.subjects,
        definition.defaultDocuments,
        definition.defaultLanguage,
      ),
    ).not.toThrow();
  });

  it("validates and renders every code-defined language version", () => {
    const events = new Set(EMAIL_TEMPLATE_DEFINITIONS.map((definition) => definition.event));

    expect(events.size).toBe(EMAIL_TEMPLATE_DEFINITIONS.length);

    for (const definition of EMAIL_TEMPLATE_DEFINITIONS) {
      expect(() =>
        service.validatePublished(
          definition.event,
          definition.name,
          definition.subjects,
          definition.defaultDocuments,
          definition.defaultLanguage,
        ),
      ).not.toThrow();

      for (const language of Object.values(SUPPORTED_LANGUAGES)) {
        expect(definition.name[language].trim()).not.toBe("");

        const rendered = renderEmailTemplate({
          document: definition.defaultDocuments[language],
          subject: definition.subjects[language],
          variables: service.getSampleVariables(definition.event),
          branding: { companyName: "Acme", primaryColor: "#4796FD" },
        });

        expect(rendered.subject).not.toContain("{{");
        expect(rendered.html).not.toContain("{{");
        expect(rendered.text).not.toContain("{{");
      }
    }
  });

  it("rejects unknown and malformed variables", () => {
    const definition = EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT.welcome;
    const unknownSubject = { ...definition.subjects, en: "Hello {{ unknown_value }}" };
    const malformedSubject = { ...definition.subjects, en: "Hello {{ invalid-value }}" };

    expect(() =>
      service.validateDraft(definition.event, unknownSubject, definition.defaultDocuments),
    ).toThrow("emailTemplates.errors.unsupportedVariables");
    expect(() =>
      service.validateDraft(definition.event, malformedSubject, definition.defaultDocuments),
    ).toThrow("emailTemplates.errors.malformedVariables");
  });

  it("rejects unsafe external image hosts", () => {
    const document: EmailTemplateDocument = {
      type: "doc",
      version: EMAIL_TEMPLATE_DOCUMENT_VERSION,
      content: [
        {
          type: EMAIL_TEMPLATE_BLOCK_TYPES.IMAGE,
          attrs: { src: "https://127.0.0.1/image.png", alt: "Private image" },
        },
      ],
    };

    expect(() =>
      service.validateDraft(EMAIL_TEMPLATE_EVENTS.WELCOME, { en: "Welcome" }, { en: document }),
    ).toThrow("emailTemplates.errors.privateImageHost");
  });

  it("requires mandatory authentication links when publishing", () => {
    const definition = EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT.password_recovery;
    const contentWithoutResetLink = {
      en: {
        ...definition.defaultDocuments.en,
        content: definition.defaultDocuments.en.content.filter(
          (block) => block.type !== EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON,
        ),
      },
    };

    expect(() =>
      service.validatePublished(
        definition.event,
        definition.name,
        definition.subjects,
        contentWithoutResetLink,
        SUPPORTED_LANGUAGES.EN,
      ),
    ).toThrow("emailTemplates.errors.missingMandatoryVariables");
  });

  it("does not consider spacer-only content complete", () => {
    const document: EmailTemplateDocument = {
      type: "doc",
      version: EMAIL_TEMPLATE_DOCUMENT_VERSION,
      content: [{ type: EMAIL_TEMPLATE_BLOCK_TYPES.SPACER, attrs: { height: 24 } }],
    };

    expect(() =>
      service.validatePublished(
        EMAIL_TEMPLATE_EVENTS.WELCOME,
        { en: "Welcome" },
        { en: "Welcome" },
        { en: document },
        SUPPORTED_LANGUAGES.EN,
      ),
    ).toThrow("emailTemplates.errors.incompleteBaseLanguage");
  });

  it("renders sample variables with React Email", () => {
    const definition = EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT.user_assigned_to_course;
    const rendered = renderEmailTemplate({
      document: definition.defaultDocuments.en,
      subject: definition.subjects.en,
      variables: service.getSampleVariables(definition.event),
      branding: { companyName: "Acme", primaryColor: "#4796FD" },
    });

    expect(rendered.subject).toContain("Leadership essentials");
    expect(rendered.html).toContain("Acme");
    expect(rendered.html).not.toContain("{{");
    expect(rendered.html).not.toContain("<h2><p>");
    expect(rendered.text).toContain("Leadership essentials");
  });
});
