import { BadRequestException, Injectable } from "@nestjs/common";
import {
  EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT,
  EMAIL_TEMPLATE_BLOCK_TYPES,
  EMAIL_TEMPLATE_INLINE_MARK_TYPES,
  EMAIL_TEMPLATE_SYSTEM_VARIABLES,
  EMAIL_TEMPLATE_VARIABLE_TYPES,
  type EmailTemplateDefinition,
  type EmailTemplateBlockNode,
  type EmailTemplateDocument,
  type EmailTemplateEvent,
  type EmailTemplateVariableValue,
  type LocalizedEmailTemplateContent,
} from "@repo/email-templates";
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import {
  EMAIL_TEMPLATE_VARIABLE_PATTERN,
  EMAIL_TEMPLATE_ASSET_PATTERN,
  UNSAFE_EMAIL_TEMPLATE_IMAGE_HOSTNAMES,
} from "../email-template.constants";
import { emailTemplateDocumentSchema } from "../schemas/email-template.schema";

import type { LocalizedText, SupportedLanguages } from "@repo/shared";

@Injectable()
export class EmailTemplateValidationService {
  getDefinition(event: EmailTemplateEvent): EmailTemplateDefinition {
    const definition = EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT[event];
    if (!definition) throw new BadRequestException("emailTemplates.errors.unsupportedEvent");
    return definition;
  }

  validateDraft(
    event: EmailTemplateEvent,
    subject: LocalizedText,
    content: LocalizedEmailTemplateContent,
  ) {
    const definition = this.getDefinition(event);
    for (const document of Object.values(content)) {
      this.validateEmailTemplateDocumentStructure(document);
    }
    const templateText = this.collectTemplateText(subject, content);

    this.validateVariableSyntax(templateText);
    this.validateTemplateVariables(templateText, definition);

    const sampleVariables = this.getSampleVariables(event);

    for (const document of Object.values(content)) {
      this.validateEmailTemplateUrls(document, sampleVariables);
    }
  }

  validatePublished(
    event: EmailTemplateEvent,
    name: LocalizedText,
    subject: LocalizedText,
    content: LocalizedEmailTemplateContent,
    baseLanguage: SupportedLanguages,
  ) {
    this.validateDraft(event, subject, content);
    this.assertCompleteTranslation(name, subject, content, baseLanguage);
    for (const language of this.getCompleteLocales(subject, content)) {
      this.assertRequiredActionLinks(event, content[language]!);
    }
  }

  assertCompleteTranslation(
    name: LocalizedText,
    subject: LocalizedText,
    content: LocalizedEmailTemplateContent,
    language: SupportedLanguages,
  ) {
    const document = content[language];

    if (
      !name[language]?.trim() ||
      !subject[language]?.trim() ||
      !this.hasMeaningfulContent(document)
    ) {
      throw new BadRequestException("emailTemplates.errors.incompleteBaseLanguage");
    }
  }

  getCompleteLocales(
    subject: LocalizedText,
    content: LocalizedEmailTemplateContent,
  ): SupportedLanguages[] {
    return Object.values(SUPPORTED_LANGUAGES).filter(
      (language) =>
        Boolean(subject[language]?.trim()) && this.hasMeaningfulContent(content[language]),
    );
  }

  getTranslationWarnings(
    subject: LocalizedText,
    content: LocalizedEmailTemplateContent,
    baseLanguage: SupportedLanguages,
  ) {
    const completeLocales = new Set(this.getCompleteLocales(subject, content));

    const warnings: string[] = [];
    if (
      Object.values(SUPPORTED_LANGUAGES).some(
        (language) => language !== baseLanguage && !completeLocales.has(language),
      )
    ) {
      warnings.push("emailTemplates.warnings.translationFallback");
    }
    for (const document of Object.values(content)) {
      if (!document.content.some((block) => block.type === EMAIL_TEMPLATE_BLOCK_TYPES.HEADER))
        warnings.push("emailTemplates.warnings.missingHeader");
      if (!document.content.some((block) => block.type === EMAIL_TEMPLATE_BLOCK_TYPES.FOOTER))
        warnings.push("emailTemplates.warnings.missingFooter");
    }
    return [...new Set(warnings)];
  }

  resolveEmailTemplateLanguage(
    subject: LocalizedText,
    content: LocalizedEmailTemplateContent,
    language: SupportedLanguages,
    baseLanguage: SupportedLanguages,
  ) {
    const completeLocales = this.getCompleteLocales(subject, content);
    const resolvedLanguage = completeLocales.includes(language) ? language : baseLanguage;
    if (!completeLocales.includes(resolvedLanguage)) {
      throw new BadRequestException("emailTemplates.errors.incompleteBaseLanguage");
    }
    return resolvedLanguage;
  }

  private assertRequiredActionLinks(event: EmailTemplateEvent, document: EmailTemplateDocument) {
    const urls: string[] = [];
    for (const block of document.content) {
      if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON && block.attrs.label.trim()) {
        urls.push(block.attrs.url.trim());
      }
      if ("content" in block && block.content) {
        for (const paragraph of block.content) {
          for (const node of paragraph.content ?? []) {
            if (!node.text.trim()) continue;
            for (const mark of node.marks ?? []) {
              if (mark.type === EMAIL_TEMPLATE_INLINE_MARK_TYPES.LINK)
                urls.push(mark.attrs.href.trim());
            }
          }
        }
      }
    }

    const missing = this.getDefinition(event)
      .variables.filter((variable) => variable.requiredInTemplate)
      .filter(
        (variable) =>
          !urls.some((url) => {
            const tokens = this.extractVariables(url);
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

  getSampleVariables(event: EmailTemplateEvent): Record<string, EmailTemplateVariableValue> {
    const variables = [...EMAIL_TEMPLATE_SYSTEM_VARIABLES, ...this.getDefinition(event).variables];
    return Object.fromEntries(variables.map((variable) => [variable.key, variable.sampleValue]));
  }

  validateRuntimeVariables(
    event: EmailTemplateEvent,
    document: EmailTemplateDocument,
    variables: Record<string, EmailTemplateVariableValue>,
  ) {
    this.validateEmailTemplateDocumentStructure(document);
    for (const definition of [
      ...EMAIL_TEMPLATE_SYSTEM_VARIABLES,
      ...this.getDefinition(event).variables,
    ]) {
      const value = variables[definition.key];

      if (value === undefined || value === "") {
        if (definition.required)
          throw new BadRequestException("emailTemplates.errors.missingMandatoryVariables");
        continue;
      }

      if (definition.type === EMAIL_TEMPLATE_VARIABLE_TYPES.COLLECTION) {
        if (!Array.isArray(value))
          throw new BadRequestException("emailTemplates.errors.invalidContent");
        continue;
      }

      const expectedType =
        definition.type === EMAIL_TEMPLATE_VARIABLE_TYPES.NUMBER ||
        definition.type === EMAIL_TEMPLATE_VARIABLE_TYPES.BOOLEAN
          ? definition.type
          : "string";

      if (typeof value !== expectedType)
        throw new BadRequestException("emailTemplates.errors.invalidContent");
    }
    this.assertRequiredActionLinks(event, document);
    this.validateEmailTemplateUrls(document, variables);
  }

  private validateTemplateVariables(
    serializedTemplate: string,
    definition: EmailTemplateDefinition,
  ) {
    const variables = this.extractVariables(serializedTemplate);
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

  private validateVariableSyntax(serializedTemplate: string) {
    const withoutValidVariables = serializedTemplate.replace(EMAIL_TEMPLATE_VARIABLE_PATTERN, "");

    if (withoutValidVariables.includes("{{") || withoutValidVariables.includes("}}")) {
      throw new BadRequestException("emailTemplates.errors.malformedVariables");
    }
  }

  private extractVariables(value: string) {
    return [...value.matchAll(EMAIL_TEMPLATE_VARIABLE_PATTERN)].map((match) => match[1]);
  }

  private collectTemplateText(subject: LocalizedText, content: LocalizedEmailTemplateContent) {
    const values = Object.values(subject).filter((value): value is string => value !== undefined);

    for (const document of Object.values(content)) {
      for (const block of document.content) {
        if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON)
          values.push(block.attrs.label, block.attrs.url);
        if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.IMAGE)
          values.push(block.attrs.src, block.attrs.alt);
        if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.FOOTER) values.push(block.attrs.text);

        if ("content" in block && block.content) {
          for (const paragraph of block.content) {
            for (const node of paragraph.content ?? []) {
              values.push(node.text);
              for (const mark of node.marks ?? []) {
                if (mark.type === EMAIL_TEMPLATE_INLINE_MARK_TYPES.LINK) {
                  values.push(mark.attrs.href);
                }
              }
            }
          }
        }
      }
    }

    return values.join("\n");
  }

  private validateEmailTemplateDocumentStructure(document: unknown) {
    if (!Value.Check(emailTemplateDocumentSchema, document)) {
      throw new BadRequestException("emailTemplates.errors.invalidContent");
    }
  }

  private validateEmailTemplateUrls(
    document: EmailTemplateDocument,
    variables: Readonly<Record<string, EmailTemplateVariableValue>>,
  ) {
    for (const block of document.content) {
      if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON) {
        this.validateHttpsUrlTemplate(block.attrs.url, false, variables);
      }
      if (
        block.type === EMAIL_TEMPLATE_BLOCK_TYPES.IMAGE &&
        !EMAIL_TEMPLATE_ASSET_PATTERN.test(block.attrs.src)
      ) {
        this.validateHttpsUrlTemplate(block.attrs.src, true, variables);
      }

      for (const url of this.getEmailTemplateInlineLinkUrls(block)) {
        this.validateHttpsUrlTemplate(url, false, variables);
      }
    }
  }

  private getEmailTemplateInlineLinkUrls(block: EmailTemplateBlockNode): string[] {
    if (!("content" in block) || !block.content) return [];

    return block.content
      .flatMap((paragraph) => paragraph.content ?? [])
      .flatMap((node) => node.marks ?? [])
      .flatMap((mark) =>
        mark.type === EMAIL_TEMPLATE_INLINE_MARK_TYPES.LINK ? [mark.attrs.href] : [],
      );
  }

  private validateHttpsUrlTemplate(
    value: string,
    rejectPrivateHosts: boolean,
    sampleVariables: Readonly<Record<string, EmailTemplateVariableValue>>,
  ) {
    this.validateVariableSyntax(value);
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

    if (normalizedHostname.startsWith("::ffff:")) return true;

    if (/^(fc|fd|fe8|fe9|fea|feb)[0-9a-f:]*$/i.test(normalizedHostname)) return true;

    const octets = normalizedHostname.split(".").map(Number);
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) return false;

    return (
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168)
    );
  }

  private hasMeaningfulContent(document: EmailTemplateDocument | undefined) {
    if (!document) return false;
    return document.content.some((block) => {
      if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON)
        return Boolean(block.attrs.label.trim());
      if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.IMAGE) return Boolean(block.attrs.src.trim());
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
