import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "@remix-run/react";
import { useEffect, useMemo, useState, useRef } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useSubmitQuiz, useRetakeQuiz, useQuizRetakeStatus } from "~/api/mutations";
import { useExpireQuizAttempt } from "~/api/mutations/useExpireQuizAttempt";
import { useStartQuizAttempt } from "~/api/mutations/useStartQuizAttempt";
import { courseQueryOptions, lessonQueryOptions } from "~/api/queries";
import { certificatesQueryOptions } from "~/api/queries/useCertificates";
import { queryClient } from "~/api/queryClient";
import { invalidateLearningPathProgressionData } from "~/api/utils/invalidateLearningPathProgressionData";
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
import { useCourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { LEARNING_HANDLES } from "../../../../e2e/data/learning/handles";
import { QuizContextProvider } from "../components/QuizContextProvider";

import { Questions } from "./Questions";
import { QuizFormSchema } from "./schemas";
import { useQuizAvailability } from "./useQuizAvailability";
import {
  leftAttemptsToDisplay,
  getEmptyQuizAnswers,
  getQuizTooltipText,
  getUserAnswers,
  parseQuizFormData,
} from "./utils";

import type { QuizForm } from "./types";
import type { GetLessonByIdResponse } from "~/api/generated-api";

type QuizProps = {
  lesson: GetLessonByIdResponse["data"];
  userId: string;
};

export const Quiz = ({ lesson, userId }: QuizProps) => {
  const { courseId: courseSlug = "" } = useParams();
  const { t, i18n } = useTranslation();
  const { isPreviewMode } = useCourseAccessProvider();

  const language = useLanguageStore((state) => state.language);
  const { mutate: startAttempt, isPending: isStarting } = useStartQuizAttempt();
  const { mutate: expireAttempt } = useExpireQuizAttempt();
  const expiredRequest = useRef<string | null>(null);
  const attempt = lesson.quizAttempt;
  const settings = lesson.quizSettings;
  const { now, isBeforeOpening, isUnavailable, openingSecondsLeft } = useQuizAvailability(
    settings?.availableFrom,
    settings?.availableUntil,
  );
  const openingTimeLabel = [
    Math.floor(openingSecondsLeft / 3600),
    Math.floor((openingSecondsLeft % 3600) / 60),
    openingSecondsLeft % 60,
  ]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
  const requiresStart = Boolean(lesson.quizRequiresStart || attempt);
  const expiresAt = attempt?.expiresAt ? Date.parse(attempt.expiresAt) : null;
  const isExpired =
    attempt?.status === "expired" ||
    (attempt?.status === "active" && expiresAt !== null && expiresAt <= now);

  useEffect(() => {
    if (isExpired && attempt && expiredRequest.current !== attempt.id) {
      expiredRequest.current = attempt.id;
      expireAttempt({ lessonId: lesson.id, language });
    }
  }, [isExpired, attempt, lesson.id, language, expireAttempt]);

  const questions = useMemo(() => {
    const rows = [...(lesson.quizDetails?.questions ?? [])];
    if (!attempt) return rows;
    const ranks = new Map(attempt.questionOrder.map((id, index) => [id, index]));
    return rows
      .sort((a, b) => (ranks.get(a.id) ?? 0) - (ranks.get(b.id) ?? 0))
      .map((question, index) => {
        const options = new Map(
          (attempt.optionOrder[question.id] ?? []).map((id, rank) => [id, rank]),
        );
        return {
          ...question,
          displayOrder: index + 1,
          options: [...(question.options ?? [])].sort(
            (a, b) => (options.get(a.id) ?? 0) - (options.get(b.id) ?? 0),
          ),
        };
      });
  }, [lesson.quizDetails?.questions, attempt]);
  const [isRetakingQuiz, setIsRetakingQuiz] = useState(false);
  const isUserSubmittedAnswer = Boolean(lesson.lessonCompleted) && !isRetakingQuiz;

  const methods = useForm<QuizForm>({
    mode: "onSubmit",
    defaultValues: (isUserSubmittedAnswer
      ? getUserAnswers(questions)
      : getEmptyQuizAnswers(questions)) as QuizForm,
    resolver: zodResolver(QuizFormSchema(t)),
  });

  const { mutate: submitQuiz, isPending: isSubmitting } = useSubmitQuiz({
    handleOnSuccess: async () => {
      setIsRetakingQuiz(false);

      await Promise.all([
        queryClient.invalidateQueries(lessonQueryOptions(lesson.id, language, userId)),
        queryClient.invalidateQueries({ queryKey: ["lessonProgress", lesson.id] }),
        queryClient.invalidateQueries(certificatesQueryOptions({ userId })),
        queryClient.invalidateQueries({ queryKey: ["certificate", userId] }),
        queryClient.invalidateQueries(courseQueryOptions(courseSlug)),
        invalidateLearningPathProgressionData(),
      ]);
    },
  });

  const { mutate: retakeQuiz, isPending: isRetaking } = useRetakeQuiz({
    lessonId: lesson.id,
    handleOnSuccess: async () => {
      setIsRetakingQuiz(true);
      await queryClient.invalidateQueries(lessonQueryOptions(lesson.id, language, userId));
      methods.reset(getEmptyQuizAnswers(questions ?? []));
    },
  });

  const { hoursLeft, canRetake } = useQuizRetakeStatus(
    lesson.attempts,
    lesson.attemptsLimit,
    lesson.updatedAt,
    lesson.quizCooldownInHours,
  );

  useEffect(() => {
    setIsRetakingQuiz(false);
  }, [lesson.id]);

  if (!questions.length) return null;

  const attemptLimitReached =
    !lesson.quizCooldownInHours &&
    lesson.attemptsLimit !== null &&
    (lesson.attempts ?? 0) >= lesson.attemptsLimit;
  const mayRetake = attempt ? !attemptLimitReached && !isUnavailable && canRetake : canRetake;
  let remainingAttemptsLabel = leftAttemptsToDisplay(
    lesson.attempts,
    lesson.attemptsLimit,
    canRetake,
    hoursLeft,
  );
  let retakeTooltip = getQuizTooltipText(
    isUserSubmittedAnswer,
    canRetake,
    hoursLeft,
    lesson.quizCooldownInHours,
  );
  if (requiresStart && !lesson.quizCooldownInHours) {
    remainingAttemptsLabel =
      lesson.attemptsLimit === null
        ? ""
        : `(${Math.max(0, lesson.attemptsLimit - (lesson.attempts ?? 0))})`;
    retakeTooltip = t("studentLessonView.tooltip.noCooldown");
    if (attemptLimitReached) retakeTooltip = t("quizPoc.errors.attemptLimit");
    if (isUnavailable) retakeTooltip = t("quizPoc.unavailable");
  }
  const showQuestions = isPreviewMode || !requiresStart || Boolean(attempt);
  const secondsLeft = Math.max(0, Math.ceil(((expiresAt ?? now) - now) / 1000));
  const timeLabel = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  const handleOnSubmit = async (data: QuizForm) => {
    const parsedQuestionsAnswers = parseQuizFormData(data);

    submitQuiz({
      attemptId: attempt?.id,
      lessonId: lesson.id,
      questionsAnswers: parsedQuestionsAnswers,
      language,
    });
  };

  const handleRetake = () => {
    retakeQuiz();
  };

  const requiredCorrect = Math.ceil(((lesson.thresholdScore ?? 0) * questions?.length) / 100);

  return (
    <FormProvider {...methods}>
      <QuizContextProvider
        isQuizFeedbackRedacted={lesson.isQuizFeedbackRedacted}
        isQuizSubmitted={isUserSubmittedAnswer}
      >
        <form
          data-testid={LEARNING_HANDLES.QUIZ_FORM}
          className="flex w-full flex-col gap-y-4"
          onSubmit={methods.handleSubmit(handleOnSubmit, () => {
            toast({
              variant: "destructive",
              description: t("studentLessonView.validation.unansweredQuestions"),
            });
          })}
        >
          {!isPreviewMode && (
            <div className="flex w-full justify-between">
              <span className="group relative">
                <span data-testid={LEARNING_HANDLES.QUIZ_SCORE}>
                  {t("studentLessonView.other.score", {
                    score: lesson.quizDetails?.score ?? 0,
                    correct: lesson.quizDetails?.correctAnswerCount ?? 0,
                    questionsNumber: questions.length,
                  })}
                </span>
              </span>
              <span data-testid={LEARNING_HANDLES.QUIZ_PASSING_THRESHOLD}>
                {t("studentLessonView.other.passingThreshold", {
                  threshold: lesson.thresholdScore,
                  correct: requiredCorrect,
                  questionsNumber: questions.length,
                })}
              </span>
            </div>
          )}

          {!isPreviewMode && isBeforeOpening && (
            <div className="grid gap-1 border-l-2 border-primary-500 pl-4 py-2">
              <p
                role="timer"
                data-testid={LEARNING_HANDLES.QUIZ_OPENING_TIMER}
                className="font-medium tabular-nums"
              >
                {t("quizPoc.opensIn", { time: openingTimeLabel })}
              </p>
              <p className="text-sm text-neutral-500">{t("quizPoc.opensAutomatically")}</p>
            </div>
          )}
          {!isPreviewMode && isUnavailable && !isBeforeOpening && (
            <p role="status">{t("quizPoc.unavailable")}</p>
          )}
          {!isPreviewMode && requiresStart && !isUserSubmittedAnswer && !isExpired && (
            <div className="grid gap-2 border-y border-neutral-200 py-3 text-sm">
              <dl className="grid gap-2">
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                  <dt className="text-neutral-500">{t("quizPoc.attemptDuration")}</dt>
                  <dd className="font-medium text-neutral-900">
                    {settings?.timeLimitMinutes
                      ? t("quizPoc.durationMinutes", { minutes: settings.timeLimitMinutes })
                      : t("quizPoc.noDurationLimit")}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                  <dt className="text-neutral-500">{t("quizPoc.windowCloses")}</dt>
                  <dd className="font-medium text-neutral-900">
                    {settings?.availableUntil ? (
                      <time dateTime={settings.availableUntil}>
                        {new Intl.DateTimeFormat(i18n.resolvedLanguage ?? language, {
                          dateStyle: "long",
                          timeStyle: "short",
                        }).format(new Date(settings.availableUntil))}
                      </time>
                    ) : (
                      t("quizPoc.noClosingTime")
                    )}
                  </dd>
                </div>
              </dl>
              {settings?.availableUntil && (
                <p className="text-neutral-500">{t("quizPoc.windowEndsAttempt")}</p>
              )}
            </div>
          )}
          {!isPreviewMode && requiresStart && !attempt && !isUserSubmittedAnswer && (
            <Button
              type="button"
              data-testid={LEARNING_HANDLES.QUIZ_START_BUTTON}
              disabled={isStarting || isUnavailable}
              onClick={() => startAttempt({ lessonId: lesson.id, language })}
            >
              {t("quizPoc.start")}
            </Button>
          )}
          {!isPreviewMode && attempt?.status === "active" && expiresAt !== null && !isExpired && (
            <p data-testid={LEARNING_HANDLES.QUIZ_TIMER} role="timer">
              {t("quizPoc.remaining", { time: timeLabel })}
            </p>
          )}
          {isExpired && (
            <p data-testid={LEARNING_HANDLES.QUIZ_EXPIRED} role="status">
              {t("quizPoc.expired")}
            </p>
          )}
          {isUserSubmittedAnswer && !lesson.isQuizFeedbackRedacted && (
            <p data-testid={LEARNING_HANDLES.QUIZ_FEEDBACK} className="whitespace-pre-wrap">
              {lesson.isQuizPassed ? settings?.passedFeedback : settings?.failedFeedback}
            </p>
          )}
          {showQuestions && (
            <fieldset disabled={isExpired || isUnavailable || isSubmitting} className="grid gap-4">
              <Questions
                questions={questions}
                isQuizCompleted={isUserSubmittedAnswer}
                lessonId={lesson.id}
              />
            </fieldset>
          )}
          {!isPreviewMode && (
            <div className="flex gap-x-2 self-end">
              <div className="group relative">
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="inline-block">
                        <Button
                          data-testid={LEARNING_HANDLES.QUIZ_RETAKE_BUTTON}
                          variant="outline"
                          type="button"
                          onClick={handleRetake}
                          className="gap-x-1"
                          disabled={
                            (!isUserSubmittedAnswer && !isExpired) || !mayRetake || isRetaking
                          }
                        >
                          <span>
                            {`${t("studentLessonView.button.retake")} ${remainingAttemptsLabel}`}
                          </span>
                        </Button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      align="center"
                      className="rounded bg-black px-2 py-1 text-sm text-white shadow-md"
                    >
                      {retakeTooltip}
                      <TooltipArrow className="fill-black" />
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Button
                data-testid={LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON}
                type="submit"
                className="flex items-center gap-x-2"
                disabled={
                  isUserSubmittedAnswer ||
                  isExpired ||
                  isUnavailable ||
                  isSubmitting ||
                  (requiresStart && !attempt)
                }
              >
                <span>{t("studentLessonView.button.submit")}</span>
                <Icon name="ArrowRight" className="h-auto w-4" />
              </Button>
            </div>
          )}
        </form>
      </QuizContextProvider>
    </FormProvider>
  );
};
