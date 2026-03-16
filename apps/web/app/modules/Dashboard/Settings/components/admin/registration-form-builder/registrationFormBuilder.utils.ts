import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { escape } from "lodash-es";
import { z } from "zod";

import type { UpdateRegistrationFormBody } from "~/api/generated-api";

const fieldSchema = z.object({
  id: z.string().optional(),
  type: z.literal("checkbox"),
  label: z.object({
    en: z.string(),
    pl: z.string(),
  }),
  required: z.boolean(),
  displayOrder: z.number(),
  archived: z.boolean(),
});

export const registrationFormSchema = z.object({
  fields: z.array(fieldSchema).superRefine((fields, ctx) => {
    fields.forEach((field, index) => {
      for (const language of Object.values(SUPPORTED_LANGUAGES)) {
        if (!escape(field.label[language])) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, "label", language],
            message: "registrationFormBuilder.validation.labelRequired",
          });
        }
      }
    });
  }),
});

export type RegistrationFormValues = z.infer<typeof registrationFormSchema>;

export const createEmptyField = (
  displayOrder: number,
): RegistrationFormValues["fields"][number] => ({
  type: "checkbox",
  required: false,
  displayOrder,
  archived: false,
  label: {
    en: "",
    pl: "",
  },
});

export const buildUpdateRegistrationFormBody = (
  fields: RegistrationFormValues["fields"],
): UpdateRegistrationFormBody => ({
  fields: fields.map((field, index) => ({
    id: field.id,
    type: "checkbox",
    required: field.required,
    archived: field.archived,
    displayOrder: index,
    label: field.label,
  })),
});
