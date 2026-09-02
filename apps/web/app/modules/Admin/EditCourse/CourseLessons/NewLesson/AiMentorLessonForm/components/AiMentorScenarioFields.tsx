import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { BaseEditor } from "~/components/RichText/Editor";
import { FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { Tooltip, TooltipArrow, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";

import { AI_MENTOR_LESSON_FORM_HANDLES } from "../../../../../../../../e2e/data/curriculum/handles";

import type { AiMentorLessonFormValues } from "../validators/useAiMentorLessonFormSchema";
import type { Control } from "react-hook-form";

type AiMentorScenarioFieldsProps = {
  control: Control<AiMentorLessonFormValues>;
  baseLanguageDescription?: string;
};

export const AiMentorScenarioFields = ({
  control,
  baseLanguageDescription,
}: AiMentorScenarioFieldsProps) => {
  const { t } = useTranslation();

  return (
    <FormField
      control={control}
      name="description"
      render={({ field }) => (
        <FormItem className="mb-4">
          <Label htmlFor="description" className="flex items-center gap-2">
            <span>{t("adminCourseView.curriculum.lesson.field.taskDescription")}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Icon name="Info" className="size-6 text-neutral-800" />
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="center"
                className="max-w-sm whitespace-pre-line break-words rounded bg-black px-2 py-1 text-sm text-white shadow-md"
              >
                {t("adminCourseView.curriculum.lesson.other.taskDescriptionTooltip")}
                <TooltipArrow className="fill-black" />
              </TooltipContent>
            </Tooltip>
          </Label>
          <FormControl>
            <div data-testid={AI_MENTOR_LESSON_FORM_HANDLES.DESCRIPTION_INPUT}>
              <BaseEditor
                id="description"
                content={field.value}
                placeholder={
                  baseLanguageDescription ||
                  t("adminCourseView.curriculum.lesson.placeholder.taskDescription")
                }
                parentClassName="flex h-[11lh] flex-col"
                contentClassName="min-h-0 flex-1 overflow-y-auto"
                editorClassName="min-h-0"
                {...field}
              />
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
