import { BadRequestException, Injectable } from "@nestjs/common";
import {
  getUsedEmailTemplateVariables,
  EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT,
  EMAIL_TEMPLATE_BLOCK_TYPES,
  EMAIL_TEMPLATE_INLINE_MARK_TYPES,
  EMAIL_TEMPLATE_SYSTEM_VARIABLES,
  EMAIL_TEMPLATE_VARIABLE_TYPES,
  type EmailTemplateDefinition,
  type PublishedEmailTemplate,
  type EmailTemplateBlockNode,
  type EmailTemplateDocument,
  type EmailTemplateEvent,
  type EmailTemplateVariableValue,
  type LocalizedEmailTemplateContent,
} from "@repo/email-templates";
import {
  type AutomationPlaceholderDefinition,
  SUPPORTED_LANGUAGES,
  type LocalizedText,
  type SupportedLanguages,
} from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import { isJsonValue } from "src/common/utils/isJsonValue";

import {
  EMAIL_TEMPLATE_VARIABLE_PATTERN,
  EMAIL_TEMPLATE_ASSET_PATTERN,
  UNSAFE_EMAIL_TEMPLATE_IMAGE_HOSTNAMES,
} from "../email-template.constants";
import { emailTemplateDocumentSchema } from "../schemas/email-template.schema";

import {
  generateEmailPreviewTagValue,
  addEmailTagLabelsAndSampleValues,
} from "./email-template-placeholder.utils";

@Injectable()
export class EmailTemplateValidationService {
  getEmailTemplateDefinition(event: EmailTemplateEvent): EmailTemplateDefinition {
    const definition = EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT[event];

    if (!definition) {
      throw new BadRequestException("emailTemplates.errors.unsupportedEvent");
    }

    return definition;
  }

  private getEmailTemplateValidationDefinition(
    input: EmailTemplateEvent | AutomationPlaceholderDefinition[],
  ): Pick<EmailTemplateDefinition, "variables"> {
    if (typeof input === "string") {
      return this.getEmailTemplateDefinition(input);
    }

    input = addEmailTagLabelsAndSampleValues(input);

    const names = input.map((placeholder) => placeholder.name);

    if (
      new Set(names).size !== names.length ||
      names.some((name) => !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name) || name === "company_name")
    ) {
      throw new BadRequestException("emailTemplates.errors.unsupportedVariables");
    }

    for (const placeholder of input) {
      this.assertValidPlaceholderSample(placeholder);
    }

    return {
      variables: input.map((placeholder) => ({
        key: placeholder.name,
        label: placeholder.label,
        type:
          placeholder.type === "string" || placeholder.type === "localized_string"
            ? ("text" as const)
            : placeholder.type,
        required: placeholder.required,
        sampleValue: placeholder.sampleValue as EmailTemplateVariableValue,
      })),
    };
  }

  private assertValidPlaceholderSample(placeholder: AutomationPlaceholderDefinition): void {
    const sample = placeholder.sampleValue;

    if (!isJsonValue(sample, 32)) {
      throw new BadRequestException("emailTemplates.errors.invalidContent");
    }

    if (!this.doesPlaceholderSampleMatchType(placeholder)) {
      throw new BadRequestException("emailTemplates.errors.invalidContent");
    }
  }

  private doesPlaceholderSampleMatchType(placeholder: AutomationPlaceholderDefinition): boolean {
    const sample = placeholder.sampleValue;

    if (sample === null) {
      return !placeholder.required;
    }

    switch (placeholder.type) {
      case "number":
        return typeof sample === "number" && Number.isFinite(sample);
      case "boolean":
        return typeof sample === "boolean";
      case "collection":
        return Array.isArray(sample);
      case "localized_string":
        return (
          typeof sample === "string" ||
          (typeof sample === "object" &&
            !Array.isArray(sample) &&
            Object.values(sample).every((value) => typeof value === "string"))
        );
      default:
        return typeof sample === "string";
    }
  }

  assertSafeAccountActionLinksInCompleteTranslations(
    publication: PublishedEmailTemplate,
    sensitivePlaceholders: readonly string[],
  ): void {
    const completeLocales = this.getCompleteEmailTemplateLocales(
      publication.subject,
      publication.content,
    );

    for (const language of completeLocales) {
      this.assertSafeAccountActionLinks(
        publication.subject[language]!,
        publication.content[language]!,
        sensitivePlaceholders,
      );
    }
  }

  assertSafeAccountActionLinks(
    subject: string,
    document: EmailTemplateDocument,
    keys: readonly string[],
  ) {
    const protectedKeys = new Set(keys);

    const hasProtected = (value: string) =>
      this.extractEmailTemplateVariables(value).some((key) => protectedKeys.has(key));

    if (
      this.collectEmailTemplateText([subject], [document], { includeActionUrls: false }).some(
        hasProtected,
      )
    ) {
      throw new BadRequestException("emailTemplates.errors.restrictedAuthVariables");
    }

    const actionUrls = document.content.flatMap((block) => [
      ...(block.type === EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON ? [block.attrs.url] : []),
      ...this.getEmailTemplateInlineLinkUrls(block),
    ]);

    for (const key of protectedKeys) {
      if (!actionUrls.some((url) => url.trim().match(/^{{\s*([a-zA-Z0-9_]+)\s*}}$/)?.[1] === key)) {
        throw new BadRequestException("emailTemplates.errors.missingMandatoryVariables");
      }
    }

    if (
      actionUrls.some((url) => hasProtected(url) && !/^{{\s*[a-zA-Z0-9_]+\s*}}$/.test(url.trim()))
    ) {
      throw new BadRequestException("emailTemplates.errors.restrictedAuthVariables");
    }
  }

  assertValidEmailTemplateDraft(
    event: EmailTemplateEvent | AutomationPlaceholderDefinition[],
    subject: LocalizedText,
    content: LocalizedEmailTemplateContent,
  ) {
    const definition = this.getEmailTemplateValidationDefinition(event);
    const subjects = Object.values(subject).filter((value): value is string => value !== undefined);
    const documents = Object.values(content);

    for (const document of documents) {
      this.assertValidEmailTemplateDocument(document);
      this.assertNoEmptyEmailTemplateBlocks(document);
    }

    for (const text of this.collectEmailTemplateText(subjects, documents)) {
      this.assertValidEmailTagSyntax(text);
      this.assertValidEmailTemplateTags(text, definition);
    }

    this.assertEmailAuthenticationVariableUsage(event, subjects, documents);

    const sampleVariables = this.buildEmailPreviewVariables(event);

    for (const document of documents) {
      this.assertAllowedEmailTemplateUrls(document, sampleVariables);
    }
  }

  assertEmailTemplatePublishable(
    event: EmailTemplateEvent | AutomationPlaceholderDefinition[],
    name: LocalizedText,
    subject: LocalizedText,
    content: LocalizedEmailTemplateContent,
    baseLanguage: SupportedLanguages,
  ) {
    this.assertValidEmailTemplateDraft(event, subject, content);
    this.assertCompleteEmailTemplateTranslation(name, subject, content, baseLanguage);

    for (const language of this.getCompleteEmailTemplateLocales(subject, content)) {
      this.assertRequiredEmailActionLinks(event, content[language]!);
    }
  }

  assertCompleteEmailTemplateTranslation(
    name: LocalizedText,
    subject: LocalizedText,
    content: LocalizedEmailTemplateContent,
    language: SupportedLanguages,
  ) {
    const document = content[language];

    if (
      !name[language]?.trim() ||
      !subject[language]?.trim() ||
      !this.hasMeaningfulEmailTemplateContent(document)
    ) {
      throw new BadRequestException("emailTemplates.errors.incompleteBaseLanguage");
    }
  }

  getCompleteEmailTemplateLocales(
    subject: LocalizedText,
    content: LocalizedEmailTemplateContent,
  ): SupportedLanguages[] {
    return Object.values(SUPPORTED_LANGUAGES).filter(
      (language) =>
        Boolean(subject[language]?.trim()) &&
        this.hasMeaningfulEmailTemplateContent(content[language]),
    );
  }

  collectEmailTemplateTranslationWarnings(
    subject: LocalizedText,
    content: LocalizedEmailTemplateContent,
    baseLanguage: SupportedLanguages,
  ) {
    const completeLocales = new Set(this.getCompleteEmailTemplateLocales(subject, content));

    const warnings: string[] = [];

    if (
      Object.values(SUPPORTED_LANGUAGES).some(
        (language) => language !== baseLanguage && !completeLocales.has(language),
      )
    ) {
      warnings.push("emailTemplates.warnings.translationFallback");
    }

    for (const document of Object.values(content)) {
      if (!document.content.some((block) => block.type === EMAIL_TEMPLATE_BLOCK_TYPES.HEADER)) {
        warnings.push("emailTemplates.warnings.missingHeader");
      }

      if (!document.content.some((block) => block.type === EMAIL_TEMPLATE_BLOCK_TYPES.FOOTER)) {
        warnings.push("emailTemplates.warnings.missingFooter");
      }
    }

    return [...new Set(warnings)];
  }

  resolveEmailTemplateLanguage(
    subject: LocalizedText,
    content: LocalizedEmailTemplateContent,
    language: SupportedLanguages,
    baseLanguage: SupportedLanguages,
  ) {
    const completeLocales = this.getCompleteEmailTemplateLocales(subject, content);
    const resolvedLanguage = completeLocales.includes(language) ? language : baseLanguage;

    if (!completeLocales.includes(resolvedLanguage)) {
      throw new BadRequestException("emailTemplates.errors.incompleteBaseLanguage");
    }

    return resolvedLanguage;
  }

  private assertRequiredEmailActionLinks(
    event: EmailTemplateEvent | AutomationPlaceholderDefinition[],
    document: EmailTemplateDocument,
  ) {
    const urls: string[] = [];

    for (const block of document.content) {
      if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON && block.attrs.label.trim()) {
        urls.push(block.attrs.url.trim());
      }

      if ("content" in block && block.content) {
        for (const paragraph of block.content) {
          for (const node of paragraph.content ?? []) {
            if (!node.text.trim()) {
              continue;
            }

            for (const mark of node.marks ?? []) {
              if (mark.type === EMAIL_TEMPLATE_INLINE_MARK_TYPES.LINK) {
                urls.push(mark.attrs.href.trim());
              }
            }
          }
        }
      }
    }

    const missing = this.getEmailTemplateValidationDefinition(event)
      .variables.filter((variable) => variable.requiredInTemplate)
      .filter(
        (variable) =>
          !urls.some((url) => {
            const tokens = this.extractEmailTemplateVariables(url);

            return (
              tokens.length === 1 &&
              tokens[0] === variable.key &&
              url.replace(EMAIL_TEMPLATE_VARIABLE_PATTERN, "").trim() === ""
            );
          }),
      );

    if (missing.length) {
      throw new BadRequestException("emailTemplates.errors.missingMandatoryVariables");
    }
  }

  buildEmailPreviewVariables(
    event: EmailTemplateEvent | AutomationPlaceholderDefinition[],
  ): Record<string, EmailTemplateVariableValue> {
    const variables = [
      ...EMAIL_TEMPLATE_SYSTEM_VARIABLES,
      ...this.getEmailTemplateValidationDefinition(event).variables,
    ];

    return Object.fromEntries(variables.map((variable) => [variable.key, variable.sampleValue]));
  }

  buildSafeEmailPreviewVariables(
    input: EmailTemplateEvent | AutomationPlaceholderDefinition[],
    language: SupportedLanguages,
  ) {
    const values = this.buildEmailPreviewVariables(input);

    if (typeof input === "string") {
      for (const variable of this.getEmailTemplateDefinition(input).variables) {
        values[variable.key] = generateEmailPreviewTagValue(
          variable.key,
          variable.type === "text" || variable.type === "date" ? "string" : variable.type,
          language,
        ) as EmailTemplateVariableValue;

        if (variable.requiredInTemplate) {
          values[variable.key] = `https://example.invalid/email-preview/${variable.key}`;
        }
      }

      return values;
    }

    for (const placeholder of input) {
      values[placeholder.name] = generateEmailPreviewTagValue(
        placeholder.name,
        placeholder.type,
        language,
      ) as EmailTemplateVariableValue;
    }

    return values;
  }

  assertEmailTemplateVariableValues(
    event: EmailTemplateEvent | AutomationPlaceholderDefinition[],
    document: EmailTemplateDocument,
    variables: Record<string, EmailTemplateVariableValue>,
    subject = "",
  ) {
    this.assertValidEmailTemplateDocument(document);

    const used = new Set(
      getUsedEmailTemplateVariables(
        { [SUPPORTED_LANGUAGES.EN]: subject },
        { [SUPPORTED_LANGUAGES.EN]: document },
      ),
    );

    for (const definition of [
      ...EMAIL_TEMPLATE_SYSTEM_VARIABLES,
      ...this.getEmailTemplateValidationDefinition(event).variables,
    ]) {
      if (!used.has(definition.key)) {
        continue;
      }

      this.assertEmailVariableValueType(variables[definition.key], definition.type);
    }

    this.assertEmailAuthenticationVariableUsage(event, [subject], [document]);
    this.assertRequiredEmailActionLinks(event, document);
    this.assertAllowedEmailTemplateUrls(document, variables);
  }

  private assertEmailVariableValueType(
    value: EmailTemplateVariableValue | undefined,
    type: EmailTemplateDefinition["variables"][number]["type"],
  ): void {
    if (value === undefined || value === null) {
      throw new BadRequestException("emailTemplates.errors.missingTagValue");
    }

    if (type === EMAIL_TEMPLATE_VARIABLE_TYPES.COLLECTION) {
      if (!Array.isArray(value)) {
        throw new BadRequestException("emailTemplates.errors.invalidContent");
      }

      return;
    }

    const expectedType =
      type === EMAIL_TEMPLATE_VARIABLE_TYPES.NUMBER ||
      type === EMAIL_TEMPLATE_VARIABLE_TYPES.BOOLEAN
        ? type
        : "string";

    if (typeof value !== expectedType) {
      throw new BadRequestException("emailTemplates.errors.invalidContent");
    }
  }

  /**
   * Confines credential-bearing variables (marked `requiredInTemplate` in the registry)
   * to complete button URLs or inline-link destinations, e.g. `{{ reset_link }}`.
   *
   * Rejects these tokens in subjects, visible text, image fields, and composed URLs
   * such as `https://example.com/pixel?token={{ reset_link }}`, which would leak the
   * recipient's credential when loaded. Rich-text fragments are joined per paragraph
   * so splitting a token across formatting marks cannot bypass validation.
   *
   * Inspects every supplied translation without mutating it. Required-link presence,
   * token syntax, and resolved URL protocols are validated separately.
   *
   * @throws {BadRequestException} If a protected token appears outside an allowed destination.
   */
  private assertEmailAuthenticationVariableUsage(
    event: EmailTemplateEvent | AutomationPlaceholderDefinition[],
    subjects: readonly string[],
    documents: readonly EmailTemplateDocument[],
  ) {
    const protectedKeys = new Set(
      this.getEmailTemplateValidationDefinition(event)
        .variables.filter((variable) => variable.requiredInTemplate)
        .map((variable) => variable.key),
    );

    if (!protectedKeys.size) {
      return;
    }

    const containsProtectedVariable = (text: string) =>
      this.extractEmailTemplateVariables(text).some((key) => protectedKeys.has(key));

    const nonActionText = this.collectEmailTemplateText(subjects, documents, {
      includeActionUrls: false,
    });

    const actionUrls = documents.flatMap((document) =>
      document.content.flatMap((block) => [
        ...(block.type === EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON ? [block.attrs.url] : []),
        ...this.getEmailTemplateInlineLinkUrls(block),
      ]),
    );

    const hasUnsafeAction = actionUrls.some((url) => {
      if (!containsProtectedVariable(url)) {
        return false;
      }

      return (
        this.extractEmailTemplateVariables(url).length !== 1 ||
        url.replace(EMAIL_TEMPLATE_VARIABLE_PATTERN, "").trim() !== ""
      );
    });

    if (nonActionText.some(containsProtectedVariable) || hasUnsafeAction) {
      throw new BadRequestException("emailTemplates.errors.restrictedAuthVariables");
    }
  }

  private assertValidEmailTemplateTags(
    serializedTemplate: string,
    definition: Pick<EmailTemplateDefinition, "variables">,
  ) {
    const variables = this.extractEmailTemplateVariables(serializedTemplate);
    const allowedDefinitions = [...EMAIL_TEMPLATE_SYSTEM_VARIABLES, ...definition.variables];
    const allowedVariables = new Set(allowedDefinitions.map((variable) => variable.key));
    const unknownVariables = variables.filter((variable) => !allowedVariables.has(variable));

    if (unknownVariables.length > 0) {
      throw new BadRequestException({
        message: "emailTemplates.errors.unsupportedVariables",
        variables: [...new Set(unknownVariables)],
      });
    }
  }

  private assertValidEmailTagSyntax(serializedTemplate: string) {
    const withoutValidVariables = serializedTemplate.replace(EMAIL_TEMPLATE_VARIABLE_PATTERN, "");

    if (withoutValidVariables.includes("{{") || withoutValidVariables.includes("}}")) {
      throw new BadRequestException("emailTemplates.errors.malformedVariables");
    }
  }

  private extractEmailTemplateVariables(value: string) {
    return [...value.matchAll(EMAIL_TEMPLATE_VARIABLE_PATTERN)].map((match) => match[1]);
  }

  private collectEmailTemplateText(
    subjects: readonly string[],
    documents: readonly EmailTemplateDocument[],
    { includeActionUrls = true }: { includeActionUrls?: boolean } = {},
  ) {
    const values = [...subjects];

    for (const document of documents) {
      for (const block of document.content) {
        if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON) {
          values.push(block.attrs.label);

          if (includeActionUrls) {
            values.push(block.attrs.url);
          }
        }

        if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.IMAGE) {
          values.push(block.attrs.src, block.attrs.alt);
        }

        if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.FOOTER) {
          values.push(block.attrs.text);
        }

        if ("content" in block && block.content) {
          for (const paragraph of block.content) {
            values.push((paragraph.content ?? []).map((node) => node.text).join(""));

            for (const node of paragraph.content ?? []) {
              for (const mark of node.marks ?? []) {
                if (includeActionUrls && mark.type === EMAIL_TEMPLATE_INLINE_MARK_TYPES.LINK) {
                  values.push(mark.attrs.href);
                }
              }
            }
          }
        }
      }
    }

    return values;
  }

  private assertValidEmailTemplateDocument(document: unknown) {
    if (!Value.Check(emailTemplateDocumentSchema, document)) {
      throw new BadRequestException("emailTemplates.errors.invalidContent");
    }
  }

  private assertNoEmptyEmailTemplateBlocks(document: EmailTemplateDocument) {
    for (const block of document.content) {
      let hasContent = true;

      if (
        block.type === EMAIL_TEMPLATE_BLOCK_TYPES.TEXT ||
        block.type === EMAIL_TEMPLATE_BLOCK_TYPES.HEADING
      ) {
        hasContent = block.content.some((paragraph) =>
          paragraph.content?.some((node) => node.text.trim()),
        );
      }

      if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.FOOTER) {
        hasContent = block.content
          ? block.content.some((paragraph) => paragraph.content?.some((node) => node.text.trim()))
          : Boolean(block.attrs.text.trim());
      }

      if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON) {
        hasContent = Boolean(block.attrs.label.trim());
      }

      if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.IMAGE) {
        hasContent = Boolean(block.attrs.src.trim());
      }

      if (!hasContent) {
        throw new BadRequestException("emailTemplates.errors.invalidContent");
      }
    }
  }

  private assertAllowedEmailTemplateUrls(
    document: EmailTemplateDocument,
    variables: Readonly<Record<string, EmailTemplateVariableValue>>,
  ) {
    for (const block of document.content) {
      if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON) {
        this.assertHttpsEmailLink(block.attrs.url, false, variables);
      }

      if (
        block.type === EMAIL_TEMPLATE_BLOCK_TYPES.IMAGE &&
        !EMAIL_TEMPLATE_ASSET_PATTERN.test(block.attrs.src)
      ) {
        this.assertHttpsEmailLink(block.attrs.src, true, variables);
      }

      for (const url of this.getEmailTemplateInlineLinkUrls(block)) {
        this.assertHttpsEmailLink(url, false, variables);
      }
    }
  }

  private getEmailTemplateInlineLinkUrls(block: EmailTemplateBlockNode): string[] {
    if (!("content" in block) || !block.content) {
      return [];
    }

    return block.content
      .flatMap((paragraph) => paragraph.content ?? [])
      .flatMap((node) => node.marks ?? [])
      .flatMap((mark) =>
        mark.type === EMAIL_TEMPLATE_INLINE_MARK_TYPES.LINK ? [mark.attrs.href] : [],
      );
  }

  private assertHttpsEmailLink(
    value: string,
    rejectPrivateHosts: boolean,
    sampleVariables: Readonly<Record<string, EmailTemplateVariableValue>>,
  ) {
    this.assertValidEmailTagSyntax(value);

    const resolvedTemplate = value.replace(EMAIL_TEMPLATE_VARIABLE_PATTERN, (_match, key: string) =>
      String(sampleVariables[key] ?? ""),
    );

    let url: URL;

    try {
      url = new URL(resolvedTemplate);
    } catch {
      throw new BadRequestException("emailTemplates.errors.invalidUrl");
    }

    if (url.protocol !== "https:") {
      throw new BadRequestException("emailTemplates.errors.httpsRequired");
    }

    if (rejectPrivateHosts && this.isPrivateHostname(url.hostname)) {
      throw new BadRequestException("emailTemplates.errors.privateImageHost");
    }
  }

  private isPrivateHostname(hostname: string) {
    const normalizedHostname = hostname
      .toLowerCase()
      .replace(/^\[|\]$/g, "")
      .replace(/\.$/, "");

    if (
      UNSAFE_EMAIL_TEMPLATE_IMAGE_HOSTNAMES.has(normalizedHostname) ||
      normalizedHostname.endsWith(".localhost")
    ) {
      return true;
    }

    if (normalizedHostname.startsWith("::ffff:")) {
      return true;
    }

    if (/^(fc|fd|fe8|fe9|fea|feb)[0-9a-f:]*$/i.test(normalizedHostname)) {
      return true;
    }

    const octets = normalizedHostname.split(".").map(Number);

    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) {
      return false;
    }

    return (
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168)
    );
  }

  private hasMeaningfulEmailTemplateContent(document: EmailTemplateDocument | undefined) {
    if (!document) {
      return false;
    }

    return document.content.some((block) => {
      if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON) {
        return Boolean(block.attrs.label.trim());
      }

      if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.IMAGE) {
        return Boolean(block.attrs.src.trim());
      }

      if (
        block.type === EMAIL_TEMPLATE_BLOCK_TYPES.TEXT ||
        block.type === EMAIL_TEMPLATE_BLOCK_TYPES.HEADING
      ) {
        return block.content.some((paragraph) =>
          (paragraph.content ?? []).some((node) => Boolean(node.text.trim())),
        );
      }

      return false;
    });
  }
}
