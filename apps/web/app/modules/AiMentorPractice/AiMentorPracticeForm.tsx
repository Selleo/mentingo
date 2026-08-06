import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@remix-run/react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useCreateAiMentorPractice } from "~/api/mutations/useCreateAiMentorPractice";
import { FormTextareaField } from "~/components/Form/FormTextareaFiled";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Form } from "~/components/ui/form";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { createPracticeFormSchema, type PracticeFormValues } from "./aiMentorPractice.schema";

const fields = ["challenge", "counterpart", "desiredOutcome"] as const;

export function AiMentorPracticeForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);
  const { mutateAsync: createPractice, isPending } = useCreateAiMentorPractice();
  const form = useForm<PracticeFormValues>({
    resolver: zodResolver(createPracticeFormSchema(t("common.validation.required"))),
    defaultValues: {
      challenge: "",
      counterpart: "",
      desiredOutcome: "",
    },
  });

  const submit = async (values: PracticeFormValues) => {
    const created = await createPractice({ ...values, language });
    navigate(`/ai-mentor/practice/${created.id}`, { replace: true });
  };

  return (
    <PageWrapper className="mx-auto max-w-3xl">
      <h1 className="h4">{t("aiMentorPractice.form.title")}</h1>
      <p className="mt-2 text-neutral-600">{t("aiMentorPractice.form.description")}</p>
      <Form {...form}>
        <form
          onSubmit={(event) => void form.handleSubmit(submit)(event)}
          className="mt-6 space-y-5"
        >
          {fields.map((field) => (
            <FormTextareaField
              key={field}
              control={form.control}
              name={field}
              label={t(`aiMentorPractice.form.${field}`)}
              required
              maxLength={1000}
              className="mt-2"
            />
          ))}
          <Button type="submit" disabled={isPending}>
            {t("aiMentorPractice.form.submit")}
          </Button>
        </form>
      </Form>
    </PageWrapper>
  );
}
