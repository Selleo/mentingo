import * as Switch from "@radix-ui/react-switch";
import { ASSESSMENT_TIME_LIMIT_MINUTES } from "@repo/shared";
import { useTranslation } from "react-i18next";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";
import { cn } from "~/lib/utils";
import { formatDuration } from "~/modules/Courses/utils/formatDuration";

import { QUIZ_LESSON_FORM_HANDLES } from "../../../../../../../../e2e/data/curriculum/handles";
import { defaultQuizLessonValues } from "../defaults/defaultQuizLessonValues";

import { InfoTooltip } from "./InfoTooltip";

import type { Lesson } from "../../../../EditCourse.types";
import type { QuizLessonFormValues } from "../validators/quizLessonFormSchema";
import type { UseFormReturn } from "react-hook-form";

const TIME_LIMIT_SLIDER_STEP_MINUTES = 5;

type Props = {
  form: UseFormReturn<QuizLessonFormValues>;
  lessonToEdit: Lesson | null;
  questionsCount: number;
  isAttemptsLimitEnabled: boolean;
  onSwitchChange: (checked: boolean) => void;
};

const QuizSettingsSection = ({
  form,
  lessonToEdit,
  questionsCount,
  isAttemptsLimitEnabled,
  onSwitchChange,
}: Props) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="mt-5">
        <Label className="body-base-md">
          <span className="body-base-md mr-1 text-red-500">*</span>{" "}
          {t("adminCourseView.curriculum.lesson.settings.title")}
        </Label>
      </div>

      <div className="mx-l grid max-w-md grid-cols-1 gap-4 px-4 pt-2">
        <FormField
          control={form.control}
          name="thresholdScore"
          render={({ field }) => {
            const threshold = Number(
              field.value ?? lessonToEdit?.thresholdScore ?? defaultQuizLessonValues.thresholdScore,
            );
            const requiredCorrect = Math.ceil((threshold * questionsCount) / 100);

            return (
              <FormItem>
                <div className="flex items-center gap-x-2">
                  <Label htmlFor="thresholdScore" className="body-base-md text-sm">
                    {t("adminCourseView.curriculum.lesson.settings.passingThreshold")}
                  </Label>
                  <InfoTooltip
                    message={t("adminCourseView.curriculum.lesson.toolTip.passingThreshold")}
                    iconClassName="text-sm"
                  ></InfoTooltip>
                </div>
                <FormControl>
                  <Input
                    id="thresholdScore"
                    {...field}
                    inputMode="decimal"
                    type="number"
                    placeholder={String(
                      lessonToEdit?.thresholdScore
                        ? lessonToEdit.thresholdScore
                        : defaultQuizLessonValues.thresholdScore,
                    )}
                    value={field.value === null || field.value === undefined ? "" : field.value}
                    onChange={(e) => {
                      const value = e.target.value;
                      const numValue = Number(value);
                      if (value === "") {
                        field.onChange(null);
                      } else if (numValue > 100) {
                        field.onChange(100);
                      } else if (numValue < 0) {
                        field.onChange(0);
                      } else {
                        field.onChange(numValue);
                      }
                    }}
                    className="w-full"
                  />
                </FormControl>
                <FormDescription className="ml-1 text-xs text-muted-foreground">
                  {questionsCount > 0
                    ? t("adminCourseView.curriculum.lesson.settings.numberOfQuestions", {
                        count1: requiredCorrect,
                        count2: questionsCount,
                      })
                    : t("adminCourseView.curriculum.lesson.settings.noQuestions")}
                </FormDescription>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <FormField
          control={form.control}
          name="timeLimitMinutes"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-x-2">
                <Label htmlFor="timeLimitMinutes" className="body-base-md text-sm">
                  {t("adminCourseView.curriculum.lesson.settings.timeLimitMinutes")}
                </Label>
                <InfoTooltip
                  message={t("adminCourseView.curriculum.lesson.tooltip.timeLimitMinutes")}
                  iconClassName="text-sm"
                />
              </div>
              <div className="flex items-center gap-x-4">
                {/* 0 on the slider means no limit, so it maps to null like an empty input */}
                <Slider
                  min={0}
                  max={ASSESSMENT_TIME_LIMIT_MINUTES.MAX}
                  step={TIME_LIMIT_SLIDER_STEP_MINUTES}
                  value={field.value ?? 0}
                  onValueChange={(value) => field.onChange(value || null)}
                  aria-label={t("adminCourseView.curriculum.lesson.settings.timeLimitMinutes")}
                  aria-valuetext={field.value ? formatDuration(field.value * 60, t) : undefined}
                  className="flex-1"
                />
                <FormControl>
                  <Input
                    id="timeLimitMinutes"
                    data-testid={QUIZ_LESSON_FORM_HANDLES.TIME_LIMIT_INPUT}
                    {...field}
                    inputMode="numeric"
                    type="number"
                    placeholder="0"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value === "" ? null : Number(e.target.value))
                    }
                    className="w-24"
                  />
                </FormControl>
                {/* fixed width keeps the slider from resizing as the label changes */}
                <span className="w-24 shrink-0 text-sm text-muted-foreground">
                  {!!field.value && formatDuration(field.value * 60, t)}
                </span>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <div className="body-base-md flex items-center gap-2 text-sm">
            {t("adminCourseView.curriculum.lesson.settings.attemptsLimit")}
            <InfoTooltip
              message={t("adminCourseView.curriculum.lesson.tooltip.attemptsLimit")}
              iconClassName="text-sm"
            />

            <InfoTooltip message={t("adminCourseView.curriculum.lesson.tooltip.switch")}>
              <Switch.Root
                checked={isAttemptsLimitEnabled}
                onCheckedChange={onSwitchChange}
                className={cn("relative h-6 w-11 rounded-full transition-colors", {
                  "bg-primary-500": isAttemptsLimitEnabled,
                  "bg-gray-200": !isAttemptsLimitEnabled,
                })}
              >
                <Switch.Thumb
                  className={cn(
                    "block size-4 translate-x-1 transform rounded-full bg-white transition-transform",
                    { "translate-x-6": isAttemptsLimitEnabled },
                  )}
                />
              </Switch.Root>
            </InfoTooltip>
          </div>

          <FormField
            control={form.control}
            name="attemptsLimit"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    id="attemptsLimit"
                    disabled={!isAttemptsLimitEnabled}
                    {...field}
                    inputMode="decimal"
                    type="number"
                    placeholder={String(
                      isAttemptsLimitEnabled
                        ? lessonToEdit?.attemptsLimit
                          ? String(lessonToEdit.attemptsLimit)
                          : defaultQuizLessonValues.attemptsLimit
                        : "",
                    )}
                    value={field.value === null || field.value === undefined ? "" : field.value}
                    onChange={(e) => {
                      const value = e.target.value;
                      const numValue = Number(value);
                      if (value === "") {
                        field.onChange(null);
                      } else if (numValue < 1) {
                        field.onChange(1);
                      } else {
                        field.onChange(numValue);
                      }
                    }}
                    className="w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex items-center gap-x-2">
            <Label className="body-base-md flex items-center gap-2 text-sm">
              {t("adminCourseView.curriculum.lesson.settings.quizCooldownInHours")}
            </Label>
            <InfoTooltip
              message={t("adminCourseView.curriculum.lesson.tooltip.quizCooldownInHours")}
              iconClassName="text-sm"
            ></InfoTooltip>
          </div>

          <FormField
            control={form.control}
            name="quizCooldownInHours"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    id="quizCooldownInHours"
                    disabled={!isAttemptsLimitEnabled}
                    {...field}
                    inputMode="decimal"
                    type="number"
                    placeholder={String(
                      isAttemptsLimitEnabled
                        ? lessonToEdit?.quizCooldownInHours
                          ? String(lessonToEdit.quizCooldownInHours)
                          : defaultQuizLessonValues.quizCooldownInHours
                        : "",
                    )}
                    value={field.value === null || field.value === undefined ? "" : field.value}
                    onChange={(e) => {
                      const value = e.target.value;
                      const numValue = Number(value);
                      if (value === "") {
                        field.onChange(null);
                      } else if (numValue < 1) {
                        field.onChange(1);
                      } else {
                        field.onChange(numValue);
                      }
                    }}
                    className="w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </>
  );
};

export default QuizSettingsSection;
