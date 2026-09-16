import { useTranslation } from "react-i18next";

import { AutosizeTextarea } from "~/components/ui/autosize-textarea";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { TooltipProvider } from "~/components/ui/tooltip";
import { CalendarDateTimeField } from "~/modules/Calendar/components/CalendarDateTimeField";

import { QUIZ_LESSON_FORM_HANDLES } from "../../../../../../../../e2e/data/curriculum/handles";

import type { QuizLessonFormValues } from "../validators/quizLessonFormSchema";
import type { UseFormReturn } from "react-hook-form";

function localDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function QuizConfigurationFields({
  form,
  disabled = false,
}: {
  form: UseFormReturn<QuizLessonFormValues>;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <TooltipProvider>
      <div className="grid gap-6">
        <div className="grid gap-3">
          <h3 className="text-sm font-semibold text-neutral-950">{t("quizPoc.orderingGroup")}</h3>
          {(["shuffleQuestions", "shuffleAnswers"] as const).map((name) => (
            <FormField
              key={name}
              control={form.control}
              name={`quizSettings.${name}`}
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between gap-4 sm:max-w-md">
                  <FormLabel htmlFor={name} className="text-sm font-medium leading-5">
                    {t(`quizPoc.${name}`)}
                  </FormLabel>
                  <FormControl>
                    <Switch
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      checked={field.value ?? false}
                      onCheckedChange={field.onChange}
                      disabled={disabled}
                      id={name}
                      data-testid={QUIZ_LESSON_FORM_HANDLES.settingInput(name)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          ))}
        </div>
        <div className="grid gap-4 border-t border-neutral-200 pt-5">
          <h3 className="text-sm font-semibold text-neutral-950">{t("quizPoc.timingGroup")}</h3>
          {(["availableFrom", "availableUntil"] as const).map((name) => (
            <FormField
              key={name}
              control={form.control}
              name={`quizSettings.${name}`}
              render={({ field }) => {
                const value = localDateTime(field.value);
                const date = value.slice(0, 10);
                const time = value.slice(11) || "09:00";
                return (
                  <FormItem>
                    <fieldset disabled={disabled} className="min-w-0 space-y-1 disabled:opacity-50">
                      <CalendarDateTimeField
                        label={t(`quizPoc.${name}`)}
                        tooltip={t("quizPoc.availabilityHelp")}
                        date={date}
                        time={time}
                        dateButtonTestId={QUIZ_LESSON_FORM_HANDLES.settingInput(name)}
                        timeSelectTestId={QUIZ_LESSON_FORM_HANDLES.settingInput(`${name}Time`)}
                        onDateChange={(nextDate) =>
                          field.onChange(new Date(`${nextDate}T${time}`).toISOString())
                        }
                        onTimeChange={(nextTime) => {
                          if (date) field.onChange(new Date(`${date}T${nextTime}`).toISOString());
                        }}
                      />
                      {field.value && (
                        <button
                          type="button"
                          className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-900"
                          onClick={() => field.onChange(null)}
                        >
                          {t("quizPoc.clearDate")}
                        </button>
                      )}
                    </fieldset>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          ))}
        </div>
        <FormField
          control={form.control}
          name="quizSettings.timeLimitMinutes"
          render={({ field }) => (
            <FormItem className="max-w-xs">
              <FormLabel htmlFor="timeLimitMinutes">{t("quizPoc.timeLimitMinutes")}</FormLabel>
              <FormControl>
                <Input
                  id="timeLimitMinutes"
                  data-testid={QUIZ_LESSON_FORM_HANDLES.settingInput("timeLimitMinutes")}
                  type="number"
                  min={1}
                  max={1440}
                  value={field.value ?? ""}
                  disabled={disabled}
                  onChange={(event) =>
                    field.onChange(event.target.value ? Number(event.target.value) : null)
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </TooltipProvider>
  );
}

export function QuizFeedbackFields({ form }: { form: UseFormReturn<QuizLessonFormValues> }) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4 border-t border-neutral-200 pt-5">
      <h3 className="text-sm font-semibold text-neutral-950">{t("quizPoc.feedbackGroup")}</h3>
      {(["passedFeedback", "failedFeedback"] as const).map((name) => (
        <FormField
          key={name}
          control={form.control}
          name={`quizSettings.${name}`}
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={name}>{t(`quizPoc.${name}`)}</FormLabel>
              <FormControl>
                <AutosizeTextarea
                  {...field}
                  id={name}
                  data-testid={QUIZ_LESSON_FORM_HANDLES.settingInput(name)}
                  value={field.value ?? ""}
                  maxLength={5000}
                  minRows={2}
                  maxRows={8}
                  className="rounded-md px-3 py-2 text-sm leading-6"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ))}
    </div>
  );
}
