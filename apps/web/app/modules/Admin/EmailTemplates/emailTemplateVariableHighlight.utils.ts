import type { EmailTemplateVariables } from "./emailTemplates.types";

export const getEmailTemplateVariableRanges = (text: string, variables: EmailTemplateVariables) => {
  const keys = new Set(variables.map((variable) => variable.key));
  return Array.from(text.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g))
    .filter((match) => keys.has(match[1]))
    .map((match) => ({ from: match.index, to: match.index + match[0].length }));
};
