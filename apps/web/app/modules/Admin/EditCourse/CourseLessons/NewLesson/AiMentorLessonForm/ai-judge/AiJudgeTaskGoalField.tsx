import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { BoldBulletEditor } from "~/components/RichText/Editor";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { cn } from "~/lib/utils";

import type { AiJudgeConfigurationDraft } from "./aiJudgeConfiguration.types";

export const AiJudgeTaskGoalField = () => {
  const { t } = useTranslation();
  const form = useFormContext<AiJudgeConfigurationDraft>();

  return (
    <FormField
      control={form.control}
      name="taskGoal"
      render={({ field, fieldState }) => (
        <FormItem>
          <FormLabel className="text-base text-neutral-900">
            {t("adminCourseView.curriculum.lesson.aiJudge.taskGoal")}
          </FormLabel>
          <FormControl>
            <div data-testid="curriculum-ai-mentor-judge-task-goal-input">
              <BoldBulletEditor
                content={field.value}
                onChange={field.onChange}
                ariaLabel={t("adminCourseView.curriculum.lesson.aiJudge.taskGoal")}
                parentClassName={cn("flex h-48 min-h-0 flex-col", {
                  "border-error-500": fieldState.invalid,
                })}
                contentClassName="min-h-0 flex-1 overflow-y-auto"
                editorClassName="!min-h-0"
                placeholder={t("adminCourseView.curriculum.lesson.aiJudge.taskGoalPlaceholder")}
              />
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
