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
import { formatTime, getUserAnswers, parseQuizFormData } from "./utils";

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
  const isUserSubmittedAnswer = Boolean(lesson.isThereStudentAnswer);

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

  const attempts = lesson.attempts ?? 1;

  const { cooldownTimeLeft, canRetake } = useQuizRetakeStatus(
    attempts + 1,
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

  const threshold = lesson.thresholdScore ?? 0;
  const requiredCorrect = Math.ceil((threshold * questions?.length) / 100);

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
        <div className="flex gap-x-2 self-end">
          <div className="group relative">
            <span> </span>
            <span>
              Próg zaliczenia: {lesson.thresholdScore}% ({requiredCorrect} of {questions.length}{" "}
              questions)
            </span>
          </div>
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
                        retake (
                        {!canRetake && cooldownTimeLeft !== null
                          ? 0
                          : lesson.attemptsLimit !== null
                            ? lesson.attemptsLimit - (lesson.attempts ?? 1) > 0
                              ? lesson.attemptsLimit - (lesson.attempts ?? 1)
                              : lesson.attemptsLimit
                            : ""}
                        )
                      </span>
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  align="center"
                  className="rounded bg-black px-2 py-1 text-sm text-white shadow-md"
                >
                  {!canRetake && cooldownTimeLeft !== null
                    ? `Retake available in ${formatTime(cooldownTimeLeft)}`
                    : `cooldown = ${lesson.quizCooldown ?? 0}`}
                  <TooltipArrow className="fill-black" />
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {!canRetake && cooldownTimeLeft !== null ? (
            <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
              Retake available in {formatTime(cooldownTimeLeft)}
            </div>
          ) : (
            <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
              {" "}
              cooldown = {lesson.quizCooldown ?? 0}
            </div>
          )}

          <Button
            type="submit"
            className="flex items-center gap-x-2"
            disabled={isAdminLike || isUserSubmittedAnswer || Boolean(lesson.isQuizPassed)}
          >
            <span>{t("studentLessonView.button.submit")}</span>
            <Icon name="ArrowRight" className="h-auto w-4" />
          </Button>
          <span>Próg zaliczenia: {lesson.thresholdScore ?? 0}%</span>
          <span>Wynik {lesson.quizDetails?.score}</span>
          <span>{lesson.isQuizPassed && "passed"}</span>
        </div>
      </form>
    </FormProvider>
  );
};
