import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@remix-run/react";
import { ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useCreateAiMentorPractice } from "~/api/mutations/useCreateAiMentorPractice";
import { FormTextareaField } from "~/components/Form/FormTextareaFiled";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Form } from "~/components/ui/form";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { AI_MENTOR_PRACTICE_HANDLES } from "../../../e2e/data/ai-mentor-practice/handles";

import { createPracticeFormSchema, type PracticeFormValues } from "./aiMentorPractice.schema";

const PRACTICE_SUGGESTIONS = [
  {
    label: "aiMentorPractice.form.suggestions.delayedOrder.label",
    value: "aiMentorPractice.form.suggestions.delayedOrder.value",
  },
  {
    label: "aiMentorPractice.form.suggestions.orderMistake.label",
    value: "aiMentorPractice.form.suggestions.orderMistake.value",
  },
  {
    label: "aiMentorPractice.form.suggestions.sensitiveData.label",
    value: "aiMentorPractice.form.suggestions.sensitiveData.value",
  },
] as const;

export function AiMentorPracticeForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);
  const { mutateAsync: createPractice, isPending } = useCreateAiMentorPractice();
  const form = useForm<PracticeFormValues>({
    resolver: zodResolver(createPracticeFormSchema(t("common.validation.required"))),
    defaultValues: {
      scenario: "",
    },
  });

  const submit = async (values: PracticeFormValues) => {
    const created = await createPractice({ ...values, language });
    navigate(`/ai-mentor/practice/${created.id}`, { replace: true });
  };

  return (
    <PageWrapper
      className="mx-auto max-w-3xl"
      breadcrumbs={[
        { title: t("navigationSideBar.dashboard"), href: "/dashboard" },
        { title: t("aiMentorPractice.conversationTitle"), href: "/ai-mentor/practice/new" },
      ]}
    >
      <header className="max-w-2xl">
        <h1 className="h2 text-balance text-neutral-950">{t("aiMentorPractice.form.title")}</h1>
      </header>

      <section className="mt-8">
        <Form {...form}>
          <form
            data-testid={AI_MENTOR_PRACTICE_HANDLES.FORM}
            onSubmit={(event) => void form.handleSubmit(submit)(event)}
            className="rounded-xl border border-primary-100 bg-white p-4 shadow-sm"
          >
            <FormTextareaField
              control={form.control}
              name="scenario"
              data-testid={AI_MENTOR_PRACTICE_HANDLES.SCENARIO_INPUT}
              label={t("aiMentorPractice.form.scenario")}
              placeholder={t("aiMentorPractice.form.scenarioPlaceholder")}
              required
              maxLength={3000}
              className="mt-2 h-48 border-neutral-200 bg-white px-3 py-3 text-base leading-relaxed text-neutral-950 shadow-none placeholder:text-neutral-500"
            />
            <div className="mb-6 rounded-lg p-4">
              <h3 className="mb-3 text-sm font-semibold text-neutral-900">
                {t("aiMentorPractice.form.suggestions.title")}
              </h3>
              <div className="grid min-w-0 max-w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {PRACTICE_SUGGESTIONS.map((suggestion) => (
                  <Button
                    key={suggestion.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="box-border min-w-0 justify-center px-4 text-center"
                    onClick={() =>
                      form.setValue("scenario", t(suggestion.value), {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    <span className="block w-full truncate">{t(suggestion.label)}</span>
                  </Button>
                ))}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-5 border-t border-neutral-200 pt-3">
              <p className="details max-w-sm text-neutral-500">
                {t("aiMentorPractice.form.scenarioHint")}
              </p>
              <Button
                type="submit"
                data-testid={AI_MENTOR_PRACTICE_HANDLES.SUBMIT_BUTTON}
                disabled={isPending}
                size="lg"
                className="shrink-0 gap-2 motion-safe:active:scale-[0.98] motion-reduce:transform-none"
              >
                {t("aiMentorPractice.form.submit")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </form>
        </Form>
        <p className="details mt-3 text-center text-neutral-500">
          {t("aiMentorPractice.form.privateHint")}
        </p>
      </section>
    </PageWrapper>
  );
}
