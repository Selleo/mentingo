import { EMAIL_TEMPLATE_NODE_TYPES, SUPPORTED_LANGUAGES } from "@repo/shared";
import { z } from "zod";

import type { EmailTemplateBlocks, EmailTemplateStrings, SupportedLanguages } from "@repo/shared";

const supportedLanguageValues = Object.values(SUPPORTED_LANGUAGES) as [
  SupportedLanguages,
  ...SupportedLanguages[],
];

type TiptapJsonNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapJsonNode[];
  marks?: {
    type: string;
    attrs?: Record<string, unknown>;
  }[];
  text?: string;
};

const tiptapJsonNodeSchema: z.ZodType<TiptapJsonNode> = z
  .object({
    type: z.string().optional(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.lazy(() => z.array(tiptapJsonNodeSchema)).optional(),
    marks: z
      .array(
        z
          .object({
            type: z.string(),
            attrs: z.record(z.string(), z.unknown()).optional(),
          })
          .passthrough(),
      )
      .optional(),
    text: z.string().optional(),
  })
  .passthrough();

export const editEmailTemplateFormSchema = z
  .object({
    name: z
      .string()
      .min(1, { message: "emailTemplates.form.errors.nameRequired" })
      .max(200, { message: "emailTemplates.form.errors.nameTooLong" }),
    baseLanguage: z.enum(supportedLanguageValues),
    availableLocales: z
      .array(z.enum(supportedLanguageValues))
      .min(1, { message: "emailTemplates.form.errors.localesRequired" }),
    subject: z.record(z.enum(supportedLanguageValues), z.string()).default({}),
    blocks: tiptapJsonNodeSchema.default({ type: EMAIL_TEMPLATE_NODE_TYPES.DOC, content: [] }),
    strings: z
      .record(z.enum(supportedLanguageValues), z.record(z.string(), z.array(tiptapJsonNodeSchema)))
      .default({}),
  })
  .refine((data) => data.availableLocales.includes(data.baseLanguage), {
    message: "emailTemplates.form.errors.baseLanguageMissing",
    path: ["baseLanguage"],
  });

export type EditEmailTemplateFormValues = Omit<
  z.infer<typeof editEmailTemplateFormSchema>,
  "blocks" | "strings"
> & {
  blocks: EmailTemplateBlocks;
  strings: EmailTemplateStrings;
};
