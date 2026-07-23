import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { BaseEditor } from "~/components/RichText/Editor";
import { Button } from "~/components/ui/button";
import { FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { Tooltip, TooltipArrow, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";

import { AI_MENTOR_LESSON_FORM_HANDLES } from "../../../../../../../../e2e/data/curriculum/handles";
import { SuggestionExamples } from "../utils/AiMentor.constants";

import type { SuggestionType } from "../utils/AiMentor.constants";
import type { AiMentorLessonFormValues } from "../validators/useAiMentorLessonFormSchema";
import type { Control } from "react-hook-form";

type AiMentorInstructionsFieldProps = {
  control: Control<AiMentorLessonFormValues>;
};

export const AiMentorInstructionsField = ({ control }: AiMentorInstructionsFieldProps) => {
  const { t } = useTranslation();

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-2">
        <Label htmlFor="aiMentorInstructions" className="block">
          <span className="mr-1 text-red-500">*</span>
          {t("adminCourseView.curriculum.lesson.field.aiMentorInstructions")}
        </Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Icon name="Info" className="h-auto w-6 cursor-default text-neutral-800" />
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            align="center"
            className="max-w-xs whitespace-pre-line break-words rounded bg-black px-2 py-1 text-sm text-white shadow-md"
          >
            {t("adminCourseView.curriculum.lesson.other.aiMentorInstructionsTooltip")}
            <TooltipArrow className="fill-black" />
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-300 bg-white">
        <FormField
          control={control}
          name="aiMentorInstructions"
          render={({ field }) => (
            <FormItem className="flex min-h-0 flex-1 flex-col">
              <FormControl>
                <div
                  data-testid={AI_MENTOR_LESSON_FORM_HANDLES.INSTRUCTIONS_INPUT}
                  className="h-[22rem] min-h-0"
                >
                  <BaseEditor
                    parentClassName="flex h-full min-h-0 flex-col rounded-none border-0 after:hidden"
                    contentClassName="min-h-0 flex-1 overflow-y-auto"
                    editorClassName="!min-h-0"
                    content={field.value}
                    placeholder={t(
                      "adminCourseView.curriculum.lesson.placeholder.aiMentorInstructions",
                    )}
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};

type AiMentorSuggestionExamplesProps = {
  onSuggestionClick: (suggestion: SuggestionType) => void;
};

export const AiMentorSuggestionExamples = ({
  onSuggestionClick,
}: AiMentorSuggestionExamplesProps) => {
  const { t } = useTranslation();

  return (
    <div className="mb-6 rounded-lg bg-neutral-50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-neutral-900">
        {t("adminCourseView.curriculum.lesson.other.suggestedExamples")}
      </h3>
      <div className="grid min-w-0 max-w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {SuggestionExamples.map(({ onClick, translationKey }) => (
          <Button
            key={onClick}
            type="button"
            variant="outline"
            size="sm"
            className="box-border min-w-0 justify-center px-4 text-center"
            onClick={() => onSuggestionClick(onClick)}
          >
            <span className="block w-full truncate">{t(translationKey)}</span>
          </Button>
        ))}
      </div>
    </div>
  );
};
