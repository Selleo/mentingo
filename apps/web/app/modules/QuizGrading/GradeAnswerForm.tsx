import { zodResolver } from "@hookform/resolvers/zod";
import { ASSESSMENT_ANSWER_GRADING_STATUSES, QUIZ_REVIEW_GRADING_METHODS } from "@repo/shared";
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
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Textarea } from "~/components/ui/textarea";

import { QUIZ_GRADING_HANDLES } from "../../../e2e/data/quiz-grading/handles";

import {
  COMMENT_MAX_LENGTH,
  GRADE_VERDICTS,
  gradeAnswerFormSchema,
  verdictFromPoints,
} from "./quizGrading.utils";

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
    resolver: zodResolver(gradeAnswerFormSchema(t)),
    defaultValues: {
      verdict:
        answer.awardedPoints === null
          ? undefined
          : verdictFromPoints(answer.awardedPoints, answer.maximumPoints),
      comment: answer.reviews[0]?.comment ?? "",
    },
  });

  const onSubmit = async ({ verdict, comment }: GradeAnswerFormValues) => {
    const { nextAnswerId } = await gradeAnswer({
      answerId: answer.id,
      body: {
        method: QUIZ_REVIEW_GRADING_METHODS.PASS_FAIL,
        passed: verdict === "passed",
        comment: comment.trim() || undefined,
      },
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
          name="verdict"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("quizGrading.form.verdict", { max: answer.maximumPoints })}</FormLabel>
              <FormControl>
                <RadioGroup
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  className="flex gap-6"
                >
                  {GRADE_VERDICTS.map((verdict) => (
                    <div key={verdict} className="flex items-center gap-2">
                      <RadioGroupItem
                        value={verdict}
                        id={`grade-verdict-${verdict}`}
                        data-testid={QUIZ_GRADING_HANDLES.VERDICT_OPTION(verdict)}
                      />
                      <Label htmlFor={`grade-verdict-${verdict}`} className="cursor-pointer">
                        {t(`quizGrading.verdict.${verdict}`)}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
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
