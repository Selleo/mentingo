import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { BaseEditor } from "~/components/RichText/Editor";
import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { stripHtmlTags } from "~/utils/stripHtmlTags";

import { aiJudgeGenerationBriefSchema } from "./aiJudgeConfiguration.schema";
import { AI_JUDGE_GENERATION_MODE } from "./aiJudgeConfiguration.types";

import type { AiJudgeGenerationMode, AiJudgeGenerationRequest } from "./aiJudgeConfiguration.types";

type AiJudgeGenerationBriefFormProps = {
  mode: AiJudgeGenerationMode;
  onGenerate: (request: AiJudgeGenerationRequest) => Promise<void> | void;
};

const IMPROVEMENT_SUGGESTIONS = [
  "clearerCriteria",
  "betterScoring",
  "reduceOverlap",
  "clarifyBlockingErrors",
] as const;

export const AiJudgeGenerationBriefForm = ({
  mode,
  onGenerate,
}: AiJudgeGenerationBriefFormProps) => {
  const { t } = useTranslation();
  const form = useForm<{ instruction: string }>({
    resolver: zodResolver(aiJudgeGenerationBriefSchema(t)),
    defaultValues: { instruction: "" },
  });
  const handleSubmit = form.handleSubmit(({ instruction }) =>
    onGenerate({ mode, instruction: stripHtmlTags(instruction).trim() }),
  );
  const generatedArtifacts = ["taskGoal", "criteria", "threshold", "blockingErrors"].map((item) =>
    t(`adminCourseView.curriculum.lesson.aiJudge.generation.artifacts.${item}`),
  );
  const isImproveMode = mode === AI_JUDGE_GENERATION_MODE.IMPROVE;

  const appendSuggestion = (suggestion: (typeof IMPROVEMENT_SUGGESTIONS)[number]) => {
    const suggestionText = t(
      `adminCourseView.curriculum.lesson.aiJudge.generation.suggestions.${suggestion}.instruction`,
    );
    const currentInstruction = form.getValues("instruction").trim();
    const nextInstruction = currentInstruction
      ? `${currentInstruction}<p>${suggestionText}</p>`
      : `<p>${suggestionText}</p>`;
    form.setValue("instruction", nextInstruction, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <Form {...form}>
      <form
        className="flex min-h-0 min-w-0 flex-col"
        onSubmit={(event) => {
          event.stopPropagation();
          void handleSubmit(event);
        }}
      >
        <div className="mx-auto min-w-0 w-full max-w-3xl">
          <FormField
            control={form.control}
            name="instruction"
            render={({ field }) => (
              <FormItem className="min-w-0">
                <FormLabel className="text-base font-semibold text-neutral-950">
                  {t(`adminCourseView.curriculum.lesson.aiJudge.generation.${mode}.fieldLabel`)}
                </FormLabel>
                <p className="text-sm text-neutral-600">
                  {t(
                    `adminCourseView.curriculum.lesson.aiJudge.generation.${mode}.fieldDescription`,
                  )}
                </p>
                <FormControl>
                  <BaseEditor
                    content={field.value}
                    onChange={field.onChange}
                    ariaLabel={t(
                      `adminCourseView.curriculum.lesson.aiJudge.generation.${mode}.fieldLabel`,
                    )}
                    parentClassName="mt-3 flex h-52 min-h-0 min-w-0 flex-col"
                    contentClassName="min-h-0 flex-1 overflow-y-auto"
                    editorClassName="!min-h-0"
                    placeholder={t(
                      `adminCourseView.curriculum.lesson.aiJudge.generation.${mode}.placeholder`,
                    )}
                  />
                </FormControl>
                <FormMessage />

                {isImproveMode && (
                  <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                    {IMPROVEMENT_SUGGESTIONS.map((suggestion) => (
                      <Button
                        key={suggestion}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="box-border min-w-0 justify-center px-4 text-center font-normal"
                        onClick={() => appendSuggestion(suggestion)}
                      >
                        {t(
                          `adminCourseView.curriculum.lesson.aiJudge.generation.suggestions.${suggestion}.label`,
                        )}
                      </Button>
                    ))}
                  </div>
                )}

                {!isImproveMode && (
                  <div className="pt-1 text-xs text-neutral-500">
                    <p className="font-medium text-neutral-700">
                      {t("adminCourseView.curriculum.lesson.aiJudge.generation.willCreate")}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                      {generatedArtifacts.map((artifact) => (
                        <span key={artifact}>- {artifact}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-3">
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && (
                      <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden />
                    )}
                    {t(
                      isImproveMode
                        ? "adminCourseView.curriculum.lesson.aiJudge.generation.improveAssessment"
                        : "adminCourseView.curriculum.lesson.aiJudge.generation.generateDraft",
                    )}
                  </Button>
                </div>
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );
};
