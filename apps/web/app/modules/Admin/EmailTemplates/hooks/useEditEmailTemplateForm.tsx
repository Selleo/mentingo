import { zodResolver } from "@hookform/resolvers/zod";
import { EMAIL_TEMPLATE_NODE_TYPES } from "@repo/shared";
import { useForm } from "react-hook-form";

import { useUpdateEmailTemplate } from "~/api/mutations/admin/useUpdateEmailTemplate";

import { editEmailTemplateFormSchema } from "../validators/editEmailTemplateFormSchema";

import type { EditEmailTemplateFormValues } from "../validators/editEmailTemplateFormSchema";
import type { EmailTemplateBlocks, EmailTemplateStrings } from "@repo/shared";
import type { GetTemplateResponse } from "~/api/generated-api";

type Template = GetTemplateResponse["data"];

const EMPTY_DOC: EmailTemplateBlocks = { type: EMAIL_TEMPLATE_NODE_TYPES.DOC, content: [] };

export const useEditEmailTemplateForm = (template: Template, onSuccess?: () => void) => {
  const { mutateAsync: updateEmailTemplate, isPending } = useUpdateEmailTemplate();

  const form = useForm<EditEmailTemplateFormValues>({
    resolver: zodResolver(editEmailTemplateFormSchema),
    mode: "onChange",
    defaultValues: {
      name: template.name,
      baseLanguage: template.baseLanguage,
      availableLocales: template.availableLocales,
      subject: template.subject ?? {},
      blocks: (template.blocks as EmailTemplateBlocks | undefined) ?? EMPTY_DOC,
      strings: (template.strings as EmailTemplateStrings | undefined) ?? {},
    },
  });

  const onSubmit = async (values: EditEmailTemplateFormValues) => {
    await updateEmailTemplate({
      id: template.id,
      data: {
        name: values.name,
        baseLanguage: values.baseLanguage,
        availableLocales: values.availableLocales,
        subject: values.subject,
        blocks: values.blocks,
        strings: values.strings,
      },
    });
    form.reset(values, { keepValues: true });
    onSuccess?.();
  };

  return { form, onSubmit, isSubmitting: isPending };
};
