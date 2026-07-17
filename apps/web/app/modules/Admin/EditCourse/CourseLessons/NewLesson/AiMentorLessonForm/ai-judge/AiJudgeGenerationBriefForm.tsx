import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { DialogFooter } from "~/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

import { aiJudgeGenerationBriefSchema } from "./aiJudgeConfiguration.schema";

import type { AiJudgeGenerationMode, AiJudgeGenerationRequest } from "./aiJudgeConfiguration.types";

type AiJudgeGenerationBriefFormProps = {
  mode: AiJudgeGenerationMode;
  onGenerate: (request: AiJudgeGenerationRequest) => Promise<void> | void;
};

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
    onGenerate({ mode, instruction: instruction.trim() }),
  );

  return (
    <Form {...form}>
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.stopPropagation();
          void handleSubmit(event);
        }}
      >
        <FormField
          control={form.control}
          name="instruction"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>
                <span className="mr-1 text-error-600">*</span>
                {t(`adminCourseView.curriculum.lesson.aiJudge.generation.${mode}.fieldLabel`)}
              </FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  className={cn("min-h-44 resize-y text-base leading-6", {
                    "border-error-500": fieldState.invalid,
                  })}
                  placeholder={t(
                    `adminCourseView.curriculum.lesson.aiJudge.generation.${mode}.placeholder`,
                  )}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-sm font-semibold text-neutral-900">
            {t("adminCourseView.curriculum.lesson.aiJudge.generation.willCreate")}
          </p>
          <ul className="mt-3 grid gap-2 text-sm text-neutral-700 sm:grid-cols-2">
            {["taskGoal", "criteria", "threshold", "blockingErrors"].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-primary-700" aria-hidden />
                {t(`adminCourseView.curriculum.lesson.aiJudge.generation.artifacts.${item}`)}
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="mr-2 size-4" aria-hidden />
            )}
            {t("adminCourseView.curriculum.lesson.aiJudge.generation.generateDraft")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
};
