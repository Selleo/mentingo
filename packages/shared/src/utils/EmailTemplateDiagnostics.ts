import {
  EMAIL_TEMPLATE_NODE_TYPES,
  TRANSLATABLE_EMAIL_TEMPLATE_NODE_TYPES,
  EMAIL_TEMPLATE_NODE_UUID_ATTR,
} from "../constants/emailTemplateNodeTypes";

import type {
  EmailTemplateBlocks,
  EmailTemplateNode,
  EmailTemplateStrings,
} from "../types/emailNotificationTemplate";
import type { LocalizedText } from "../types/localization";
import type { SupportedLanguages } from "../constants/languages";

export type EmailTemplateDiagnosticSeverity = "error" | "warning";

export type EmailTemplateDiagnosticReason =
  | "name_missing"
  | "no_language_versions"
  | "subject_missing"
  | "body_missing"
  | "button_label_missing"
  | "button_url_missing"
  | "empty_translation"
  | "invalid_url_protocol"
  | "unchanged_from_base"
  | "footer_missing";

export type EmailTemplateDiagnostic = {
  severity: EmailTemplateDiagnosticSeverity;
  language?: SupportedLanguages;
  nodeUuid?: string;
  nodeType?: string;
  reason: EmailTemplateDiagnosticReason;
  detail?: string;
};

const ALLOWED_URL_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const VARIABLE_PATTERN = /\{\{[^}]+\}\}/g;
const URL_ATTR_BY_NODE_TYPE: Record<string, string[]> = {
  [EMAIL_TEMPLATE_NODE_TYPES.BUTTON]: ["url"],
  [EMAIL_TEMPLATE_NODE_TYPES.IMAGE]: ["src", "href"],
};

const flattenText = (nodes: EmailTemplateNode[] | undefined): string => {
  if (!nodes) return "";
  let out = "";
  for (const node of nodes) {
    if (typeof node.text === "string") out += node.text;
    if (node.content) out += flattenText(node.content);
  }
  return out;
};

const walkAllTranslatableNodes = (
  blocks: EmailTemplateBlocks,
  visit: (uuid: string, node: EmailTemplateNode) => void,
) => {
  const walk = (node: EmailTemplateNode) => {
    if (node.type && TRANSLATABLE_EMAIL_TEMPLATE_NODE_TYPES.has(node.type)) {
      const uuid = node.attrs?.[EMAIL_TEMPLATE_NODE_UUID_ATTR];
      if (typeof uuid === "string" && uuid.length > 0) visit(uuid, node);
    }
    if (node.content) for (const child of node.content) walk(child);
  };
  walk(blocks);
};

const walkAllNodes = (blocks: EmailTemplateBlocks, visit: (node: EmailTemplateNode) => void) => {
  const walk = (node: EmailTemplateNode) => {
    visit(node);
    if (node.content) for (const child of node.content) walk(child);
  };
  walk(blocks);
};

export const computeEmailTemplateDiagnostics = (input: {
  name?: string;
  availableLocales: SupportedLanguages[];
  baseLanguage: SupportedLanguages;
  subject: LocalizedText;
  blocks: EmailTemplateBlocks;
  strings: EmailTemplateStrings;
}): EmailTemplateDiagnostic[] => {
  const diagnostics: EmailTemplateDiagnostic[] = [];

  if (typeof input.name !== "string" || !input.name.trim()) {
    diagnostics.push({ severity: "error", reason: "name_missing" });
  }

  if (input.availableLocales.length === 0) {
    diagnostics.push({ severity: "error", reason: "no_language_versions" });
  }

  const baseSubject = input.subject?.[input.baseLanguage];
  if (typeof baseSubject !== "string" || !baseSubject.trim()) {
    diagnostics.push({
      severity: "error",
      language: input.baseLanguage,
      reason: "subject_missing",
    });
  }

  let translatableNodeCount = 0;
  let hasFooterNode = false;
  walkAllNodes(input.blocks, (node) => {
    if (!node.type) return;
    if (TRANSLATABLE_EMAIL_TEMPLATE_NODE_TYPES.has(node.type)) translatableNodeCount += 1;
    if (node.type === EMAIL_TEMPLATE_NODE_TYPES.FOOTER) hasFooterNode = true;
  });

  if (translatableNodeCount === 0) {
    diagnostics.push({
      severity: "error",
      language: input.baseLanguage,
      reason: "body_missing",
    });
  }

  if (!hasFooterNode) {
    diagnostics.push({ severity: "warning", reason: "footer_missing" });
  }

  walkAllNodes(input.blocks, (node) => {
    if (node.type !== EMAIL_TEMPLATE_NODE_TYPES.BUTTON) return;
    const uuid = node.attrs?.[EMAIL_TEMPLATE_NODE_UUID_ATTR] as string | undefined;
    const rawText = node.attrs?.text;
    const buttonLabel = typeof rawText === "string" ? rawText.trim() : "";
    if (!buttonLabel) {
      diagnostics.push({
        severity: "error",
        language: input.baseLanguage,
        nodeUuid: uuid,
        nodeType: node.type,
        reason: "button_label_missing",
      });
    }
    const rawUrl = node.attrs?.url;
    const buttonUrl = typeof rawUrl === "string" ? rawUrl.trim() : "";
    if (!buttonUrl) {
      diagnostics.push({
        severity: "error",
        language: input.baseLanguage,
        nodeUuid: uuid,
        nodeType: node.type,
        reason: "button_url_missing",
      });
    }
  });

  walkAllNodes(input.blocks, (node) => {
    if (!node.type) return;
    const attrs = URL_ATTR_BY_NODE_TYPE[node.type];
    if (!attrs) return;
    for (const attr of attrs) {
      const raw = node.attrs?.[attr];
      if (typeof raw !== "string" || !raw.trim()) continue;
      const hasVariable = VARIABLE_PATTERN.test(raw);
      VARIABLE_PATTERN.lastIndex = 0;
      const normalized = hasVariable ? raw.replace(VARIABLE_PATTERN, "x") : raw;
      try {
        const url = new URL(normalized);
        if (!ALLOWED_URL_PROTOCOLS.has(url.protocol)) {
          diagnostics.push({
            severity: "error",
            language: input.baseLanguage,
            nodeUuid: node.attrs?.[EMAIL_TEMPLATE_NODE_UUID_ATTR] as string | undefined,
            nodeType: node.type,
            reason: "invalid_url_protocol",
            detail: `${attr}: ${url.protocol}`,
          });
        }
      } catch {
        if (hasVariable) continue;
        diagnostics.push({
          severity: "error",
          language: input.baseLanguage,
          nodeUuid: node.attrs?.[EMAIL_TEMPLATE_NODE_UUID_ATTR] as string | undefined,
          nodeType: node.type,
          reason: "invalid_url_protocol",
          detail: `${attr}: unparseable`,
        });
      }
    }
  });

  for (const language of input.availableLocales) {
    walkAllTranslatableNodes(input.blocks, (uuid, node) => {
      const fragment = input.strings[language]?.[uuid];
      const isEmptyFragment = !fragment || fragment.length === 0;
      let flat: string;
      if (language === input.baseLanguage && isEmptyFragment) {
        if (node.type === EMAIL_TEMPLATE_NODE_TYPES.BUTTON) {
          const raw = node.attrs?.text;
          flat = typeof raw === "string" ? raw.trim() : "";
        } else {
          flat = flattenText(node.content).trim();
        }
      } else {
        flat = flattenText(fragment).trim();
      }

      const isButton = node.type === EMAIL_TEMPLATE_NODE_TYPES.BUTTON;
      if (!flat && !isButton) {
        diagnostics.push({
          severity: language === input.baseLanguage ? "error" : "warning",
          language,
          nodeUuid: uuid,
          nodeType: node.type,
          reason: "empty_translation",
        });
      }
    });

    if (language !== input.baseLanguage) {
      walkAllTranslatableNodes(input.blocks, (uuid, node) => {
        const base = flattenText(input.strings[input.baseLanguage]?.[uuid]).trim();
        const localized = flattenText(input.strings[language]?.[uuid]).trim();
        if (base && localized && base === localized) {
          diagnostics.push({
            severity: "warning",
            language,
            nodeUuid: uuid,
            nodeType: node.type,
            reason: "unchanged_from_base",
          });
        }
      });
    }
  }

  return diagnostics;
};
