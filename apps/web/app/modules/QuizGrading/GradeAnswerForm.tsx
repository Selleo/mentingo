import { zodResolver } from "@hookform/resolvers/zod";
import { ASSESSMENT_ANSWER_GRADING_STATUSES } from "@repo/shared";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useGradeQuizAnswer } from "~/api/mutations/useGradeQuizAnswer";
import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";

import { QUIZ_GRADING_HANDLES } from "../../../e2e/data/quiz-grading/handles";

import { COMMENT_MAX_LENGTH, gradeAnswerFormSchema } from "./quizGrading.utils";

import type { GradeAnswerFormValues } from "./quizGrading.utils";
import type { GetAnswerDetailsResponse } from "~/api/generated-api";

type GradeAnswerFormProps = {
  answer: GetAnswerDetailsResponse["data"];
  onGraded: (nextAnswerId: string | null) => void;
};

export function GradeAnswerForm({ answer, onGraded }: GradeAnswerFormProps) {
  const { t } = useTranslation();
  const { mutateAsync: gradeAnswer, isPending } = useGradeQuizAnswer();
  const form = useForm<GradeAnswerFormValues>({
    resolver: zodResolver(gradeAnswerFormSchema(t, answer.maximumPoints)),
    defaultValues: {
      awardedPoints: answer.awardedPoints?.toString() ?? "",
      comment: answer.reviews[0]?.comment ?? "",
    },
  });

  const onSubmit = async ({ awardedPoints, comment }: GradeAnswerFormValues) => {
    const { nextAnswerId } = await gradeAnswer({
      answerId: answer.id,
      body: { awardedPoints: Number(awardedPoints), comment: comment.trim() || undefined },
    });
    onGraded(nextAnswerId);
  };

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => onSubmit(values).catch(() => undefined))}
      >
        <FormField
          control={form.control}
          name="awardedPoints"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("quizGrading.form.points", { max: answer.maximumPoints })}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={answer.maximumPoints}
                  step={1}
                  className="w-32"
                  data-testid={QUIZ_GRADING_HANDLES.POINTS_INPUT}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("quizGrading.form.comment")}</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={4}
                  maxLength={COMMENT_MAX_LENGTH}
                  placeholder={t("quizGrading.form.commentPlaceholder")}
                  data-testid={QUIZ_GRADING_HANDLES.COMMENT_INPUT}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          variant="primary"
          className="self-start"
          disabled={isPending}
          data-testid={QUIZ_GRADING_HANDLES.SUBMIT_BUTTON}
        >
          {answer.gradingStatus === ASSESSMENT_ANSWER_GRADING_STATUSES.GRADED
            ? t("quizGrading.form.regrade")
            : t("quizGrading.form.submit")}
        </Button>
      </form>
    </Form>
  );
}
