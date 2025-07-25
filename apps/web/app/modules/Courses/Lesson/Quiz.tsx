import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "@remix-run/react";
import { FormProvider, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useSubmitQuiz, useRetakeQuiz, useQuizRetakeStatus } from "~/api/mutations";
import { queryClient } from "~/api/queryClient";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { toast } from "~/components/ui/use-toast";
import { useUserRole } from "~/hooks/useUserRole";

import { Questions } from "./Questions";
import { QuizFormSchema } from "./schemas";
import {
  leftAttemptsToDisplay,
  getQuizTooltipText,
  getUserAnswers,
  parseQuizFormData,
} from "./utils";

import type { QuizForm } from "./types";
import type { GetLessonByIdResponse } from "~/api/generated-api";

type QuizProps = {
  lesson: GetLessonByIdResponse["data"];
};

export const Quiz = ({ lesson }: QuizProps) => {
  const { lessonId = "" } = useParams();
  const { t } = useTranslation();
  const { isAdminLike } = useUserRole();

  const questions = lesson.quizDetails?.questions;
  const isUserSubmittedAnswer = Boolean(lesson.lessonCompleted);

  const methods = useForm<QuizForm>({
    mode: "onSubmit",
    defaultValues: getUserAnswers(questions ?? []) as QuizForm,
    resolver: zodResolver(QuizFormSchema(t)),
  });

  const submitQuiz = useSubmitQuiz({
    handleOnSuccess: () => queryClient.invalidateQueries({ queryKey: ["lesson", lessonId] }),
  });

  const retakeQuiz = useRetakeQuiz({
    lessonId,
    handleOnSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson", lessonId] });
      methods.reset();
    },
  });

  const { hoursLeft, canRetake } = useQuizRetakeStatus(
    lesson.attempts,
    lesson.attemptsLimit,
    lesson.updatedAt,
    lesson.quizCooldown,
  );

  if (!questions?.length) return null;

  const handleOnSubmit = async (data: QuizForm) => {
    submitQuiz.mutate({ lessonId, questionsAnswers: parseQuizFormData(data) });
  };

  const handleRetake = () => {
    retakeQuiz.mutate();
  };

  const requiredCorrect = Math.ceil(((lesson.thresholdScore ?? 0) * questions?.length) / 100);

  return (
    <FormProvider {...methods}>
      <form
        className="flex w-full flex-col gap-y-4"
        onSubmit={methods.handleSubmit(handleOnSubmit, () => {
          toast({
            variant: "destructive",
            description: t("studentLessonView.validation.unansweredQuestions"),
          });
        })}
      >
        <div className="flex w-full justify-between">
          <span className="group relative">
            {t("studentLessonView.other.score", {
              score: lesson.quizDetails?.score ?? 0,
              correct: lesson.quizDetails?.correctAnswerCount ?? 0,
              questionsNumber: questions.length,
            })}
          </span>
          <span>
            {t("studentLessonView.other.passingThreshold", {
              threshold: lesson.thresholdScore,
              correct: requiredCorrect,
              questionsNumber: questions.length,
            })}
          </span>
        </div>

        <Questions questions={questions} isQuizCompleted={isUserSubmittedAnswer} />
        <div className="flex gap-x-2 self-end">
          <div className="group relative">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="inline-block">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={handleRetake}
                      className="gap-x-1"
                      disabled={
                        isAdminLike ||
                        !isUserSubmittedAnswer ||
                        Boolean(lesson.isQuizPassed) ||
                        !canRetake
                      }
                    >
                      <span>
                        {`${t("studentLessonView.button.retake")} ${leftAttemptsToDisplay(
                          lesson.attempts,
                          lesson.attemptsLimit,
                          canRetake,
                          hoursLeft,
                        )}`}
                      </span>
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  align="center"
                  className="rounded bg-black px-2 py-1 text-sm text-white shadow-md"
                >
                  {getQuizTooltipText(
                    isUserSubmittedAnswer,
                    canRetake,
                    hoursLeft,
                    lesson.quizCooldown,
                  )}
                  <TooltipArrow className="fill-black" />
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Button
            type="submit"
            className="flex items-center gap-x-2"
            disabled={isAdminLike || isUserSubmittedAnswer || Boolean(lesson.isQuizPassed)}
          >
            <span>{t("studentLessonView.button.submit")}</span>
            <Icon name="ArrowRight" className="h-auto w-4" />
          </Button>
        </div>
      </form>
    </FormProvider>
  );
};
