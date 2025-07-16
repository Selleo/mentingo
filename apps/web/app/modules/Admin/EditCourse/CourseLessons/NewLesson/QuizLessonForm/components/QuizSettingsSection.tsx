import * as Switch from "@radix-ui/react-switch";
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
import { cn } from "~/lib/utils";

import { defaultQuizLessonValues } from "../defaults/defaultQuizLessonValues";

import { InfoTooltip } from "./InfoTooltip";

import type { Lesson } from "../../../../EditCourse.types";
import type { QuizLessonFormValues } from "../validators/quizLessonFormSchema";
import type { UseFormReturn } from "react-hook-form";

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
                  "bg-blue-500": isAttemptsLimitEnabled,
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
              {t("adminCourseView.curriculum.lesson.settings.quizCooldown")}
            </Label>
            <InfoTooltip
              message={t("adminCourseView.curriculum.lesson.tooltip.quizCooldown")}
              iconClassName="text-sm"
            ></InfoTooltip>
          </div>

          <FormField
            control={form.control}
            name="quizCooldown"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    id="quizCooldown"
                    disabled={!isAttemptsLimitEnabled}
                    {...field}
                    inputMode="decimal"
                    type="number"
                    placeholder={String(
                      isAttemptsLimitEnabled
                        ? lessonToEdit?.quizCooldown
                          ? String(lessonToEdit.quizCooldown)
                          : defaultQuizLessonValues.quizCooldown
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
