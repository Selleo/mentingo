import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "@remix-run/react";
import { debounce } from "lodash-es";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import {
  useSubmitQuiz,
  useRetakeQuiz,
  useQuizRetakeStatus,
  useSaveQuizAttemptDraft,
  useStartQuizAttempt,
} from "~/api/mutations";
import { courseQueryOptions, lessonQueryOptions } from "~/api/queries";
import { certificatesQueryOptions } from "~/api/queries/useCertificates";
import { queryClient } from "~/api/queryClient";
import { invalidateLearningPathProgressionData } from "~/api/utils/invalidateLearningPathProgressionData";
import { isClosedQuizAttemptError } from "~/api/utils/refetchLessonOnClosedQuizAttempt";
import { ProgressBadge } from "~/components/Badges/ProgressBadge";
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
import { cn } from "~/lib/utils";
import { useCourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";
import { formatDuration } from "~/modules/Courses/utils/formatDuration";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { LEARNING_HANDLES } from "../../../../e2e/data/learning/handles";
import { QuizContextProvider } from "../components/QuizContextProvider";

import { Questions } from "./Questions";
import { QuizFormSchema } from "./schemas";
import { formatQuizTimeLeft, useQuizCountdown } from "./useQuizCountdown";
import {
  leftAttemptsToDisplay,
  getDraftQuizAnswers,
  getEmptyQuizAnswers,
  getQuizTooltipText,
  getRequiredMatchingAnswerCounts,
  getUserAnswers,
  parseQuizFormData,
} from "./utils";

import type { QuizForm } from "./types";
import type { GetLessonByIdResponse } from "~/api/generated-api";

const DRAFT_AUTOSAVE_DELAY_MS = 1000;

type QuizProps = {
  lesson: GetLessonByIdResponse["data"];
  userId: string;
};

export const Quiz = ({ lesson, userId }: QuizProps) => {
  const { courseId: courseSlug = "" } = useParams();
  const { t } = useTranslation();
  const { isPreviewMode } = useCourseAccessProvider();

  const { language } = useLanguageStore();

  const questions = useMemo(
    () =>
      (lesson.quizDetails?.questions ?? []).map((question) => ({
        ...question,
        options: question.options,
      })),
    [lesson.quizDetails?.questions],
  );
  const [isRetakingQuiz, setIsRetakingQuiz] = useState(false);
  const isAwaitingReview = Boolean(lesson.isQuizAwaitingReview);
  const isUserSubmittedAnswer =
    (Boolean(lesson.lessonCompleted) || isAwaitingReview) && !isRetakingQuiz;
  const isTimedQuiz = Boolean(lesson.timeLimitMinutes) && !isPreviewMode;
  const quizAttempt = isTimedQuiz && !isUserSubmittedAnswer ? lesson.quizAttempt : null;
  const quizAttemptId = quizAttempt?.attemptId;

  const getInitialAnswers = () => {
    if (isUserSubmittedAnswer) return getUserAnswers(questions);
    if (quizAttempt) return getDraftQuizAnswers(questions, quizAttempt.draftAnswers);
    return getEmptyQuizAnswers(questions);
  };

  const methods = useForm<QuizForm>({
    mode: "onSubmit",
    defaultValues: getInitialAnswers(),
    // timed quizzes accept partial answers: unanswered questions score 0 points
    resolver: isTimedQuiz
      ? undefined
      : zodResolver(QuizFormSchema(t, getRequiredMatchingAnswerCounts(questions))),
  });

  const { mutate: startQuizAttempt, isPending: isStartingQuizAttempt } = useStartQuizAttempt();
  const { mutate: saveQuizAttemptDraft } = useSaveQuizAttemptDraft();
  const scheduledDraftSaveRef = useRef<ReturnType<typeof debounce> | null>(null);

  const { mutate: submitQuiz, isPending: isSubmittingQuiz } = useSubmitQuiz({
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

  const { mutate: retakeQuiz } = useRetakeQuiz({
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

  const lessonQueryKey = lessonQueryOptions(lesson.id, language, userId).queryKey;
  // pairs the (possibly cached) serverNow with the time it was fetched, for the countdown offset
  const lessonReceivedAt = queryClient.getQueryState(lessonQueryKey)?.dataUpdatedAt || undefined;

  const prefilledDraftRef = useRef(
    quizAttempt ? `${quizAttempt.attemptId}:${quizAttempt.draftSavedAt}` : null,
  );
  const hasEditsSincePrefillRef = useRef(false);

  useEffect(() => {
    if (!quizAttempt) return;

    const draftKey = `${quizAttempt.attemptId}:${quizAttempt.draftSavedAt}`;
    const isNewAttempt = !prefilledDraftRef.current?.startsWith(`${quizAttempt.attemptId}:`);
    if (prefilledDraftRef.current === draftKey) return;

    prefilledDraftRef.current = draftKey;
    // a newer draft of the same attempt (e.g. saved after the cached lesson) must not drop local edits
    if (!isNewAttempt && hasEditsSincePrefillRef.current) return;

    hasEditsSincePrefillRef.current = false;
    methods.reset(getDraftQuizAnswers(questions, quizAttempt.draftAnswers));
  }, [quizAttempt, methods, questions]);

  const saveDraftNow = useCallback(() => {
    if (!quizAttemptId) return;

    saveQuizAttemptDraft({
      lessonId: lesson.id,
      attemptId: quizAttemptId,
      questionsAnswers: parseQuizFormData(methods.getValues()),
      learningStateId: lesson.learningStateId,
    });
  }, [quizAttemptId, lesson.id, lesson.learningStateId, methods, saveQuizAttemptDraft]);

  useEffect(() => {
    if (!quizAttemptId) return;

    const scheduleDraftSave = debounce(saveDraftNow, DRAFT_AUTOSAVE_DELAY_MS);
    scheduledDraftSaveRef.current = scheduleDraftSave;

    const subscription = methods.watch((_, { name }) => {
      // a reset (prefill) has no field name and only restores what the server already has
      if (!name) return;

      hasEditsSincePrefillRef.current = true;
      scheduleDraftSave();
    });

    return () => {
      subscription.unsubscribe();
      // leaving the quiz still saves the last answers
      scheduleDraftSave.flush();
      scheduledDraftSaveRef.current = null;
    };
  }, [quizAttemptId, methods, saveDraftNow]);

  const isSubmitPendingRef = useRef(false);

  const handleOnSubmit = useCallback(
    (data: QuizForm) => {
      if (isPreviewMode || isSubmitPendingRef.current) return;

      isSubmitPendingRef.current = true;
      // the submit carries every answer, so a pending autosave would only race with it
      scheduledDraftSaveRef.current?.cancel();

      submitQuiz(
        {
          lessonId: lesson.id,
          questionsAnswers: parseQuizFormData(data),
          learningStateId: lesson.learningStateId,
          language,
        },
        {
          onError: (error) => {
            // keep the answers on the server while the attempt is still open; retry stays possible
            if (quizAttemptId && !isClosedQuizAttemptError(error)) saveDraftNow();
          },
          onSettled: () => {
            isSubmitPendingRef.current = false;
          },
        },
      );
    },
    [
      isPreviewMode,
      submitQuiz,
      lesson.id,
      lesson.learningStateId,
      language,
      quizAttemptId,
      saveDraftNow,
    ],
  );

  const handleTimeUp = useCallback(
    () => handleOnSubmit(methods.getValues()),
    [handleOnSubmit, methods],
  );

  const { secondsLeft, isWarning, isGraceOver } = useQuizCountdown({
    expiresAt: quizAttempt?.expiresAt,
    serverNow: quizAttempt?.serverNow,
    receivedAt: lessonReceivedAt,
    graceSeconds: quizAttempt?.submitGraceSeconds,
    onExpire: handleTimeUp,
  });

  useEffect(() => {
    // the server no longer accepts answers and finalizes the attempt when the lesson is read
    if (isGraceOver) {
      void queryClient.invalidateQueries(lessonQueryOptions(lesson.id, language, userId));
    }
  }, [isGraceOver, lesson.id, language, userId]);

  if (!questions.length) return null;

  const handleRetake = () => {
    if (isPreviewMode) return;
    retakeQuiz(lesson.learningStateId);
  };

  const handleStartQuizAttempt = () =>
    startQuizAttempt({ lessonId: lesson.id, language, learningStateId: lesson.learningStateId });

  const isAwaitingQuizStart = isTimedQuiz && !isUserSubmittedAnswer && !quizAttempt;
  const isTimeUp = secondsLeft === 0;
  const timerMessage = match({ isTimeUp, isWarning })
    .with({ isTimeUp: true }, () => t("studentLessonView.timedQuiz.timeUp"))
    .with({ isWarning: true }, () => t("studentLessonView.timedQuiz.warning"))
    .otherwise(() => "");

  const requiredCorrect = Math.ceil(((lesson.thresholdScore ?? 0) * questions?.length) / 100);

  return (
    <FormProvider {...methods}>
      <QuizContextProvider
        isQuizFeedbackRedacted={lesson.isQuizFeedbackRedacted}
        isQuizSubmitted={isUserSubmittedAnswer}
        isQuizAwaitingReview={isAwaitingReview}
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
                {isAwaitingReview ? (
                  <span className="flex items-center gap-x-2">
                    <span data-testid={LEARNING_HANDLES.QUIZ_AWAITING_REVIEW}>
                      <ProgressBadge progress="awaitingReview" />
                    </span>
                    {!lesson.isQuizFeedbackRedacted && (
                      <span data-testid={LEARNING_HANDLES.QUIZ_PARTIAL_SCORE}>
                        {t("studentLessonView.other.partialScore", {
                          correct: lesson.quizDetails?.correctAnswerCount ?? 0,
                          graded:
                            (lesson.quizDetails?.correctAnswerCount ?? 0) +
                            (lesson.quizDetails?.wrongAnswerCount ?? 0),
                        })}
                      </span>
                    )}
                  </span>
                ) : (
                  <span data-testid={LEARNING_HANDLES.QUIZ_SCORE}>
                    {t("studentLessonView.other.score", {
                      score: lesson.quizDetails?.score ?? 0,
                      correct: lesson.quizDetails?.correctAnswerCount ?? 0,
                      questionsNumber: questions.length,
                    })}
                  </span>
                )}
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

          {isAwaitingQuizStart && (
            <div
              data-testid={LEARNING_HANDLES.QUIZ_TIME_LIMIT_INFO}
              className="flex flex-col items-start gap-y-4"
            >
              <div className="grid w-full gap-2 border-y border-neutral-200 py-3 text-sm">
                <dl className="grid gap-2">
                  <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                    <dt className="text-neutral-500">
                      {t("studentLessonView.timedQuiz.timeLimit")}
                    </dt>
                    <dd className="font-medium text-neutral-900">
                      {formatDuration((lesson.timeLimitMinutes ?? 0) * 60, t)}
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                    <dt className="text-neutral-500">
                      {t("studentLessonView.timedQuiz.questions")}
                    </dt>
                    <dd className="font-medium text-neutral-900">{questions.length}</dd>
                  </div>
                </dl>
                <p className="text-neutral-500">{t("studentLessonView.timedQuiz.info")}</p>
              </div>
              <Button
                data-testid={LEARNING_HANDLES.QUIZ_START_BUTTON}
                type="button"
                onClick={handleStartQuizAttempt}
                disabled={isStartingQuizAttempt}
              >
                {t("studentLessonView.timedQuiz.start")}
              </Button>
            </div>
          )}

          {quizAttempt && secondsLeft !== null && (
            <div
              className={cn(
                "sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2",
                { "border-error-500 bg-error-50 text-error-700": isWarning },
              )}
            >
              <span
                role="timer"
                data-testid={LEARNING_HANDLES.QUIZ_TIMER}
                className="body-base-md tabular-nums"
              >
                {t("studentLessonView.timedQuiz.timeLeft", {
                  time: formatQuizTimeLeft(secondsLeft),
                })}
              </span>
              <span
                aria-live="polite"
                data-testid={LEARNING_HANDLES.QUIZ_TIMER_MESSAGE}
                className="body-sm"
              >
                {timerMessage}
              </span>
            </div>
          )}

          {!isAwaitingQuizStart && (
            <fieldset
              disabled={isPreviewMode || isTimeUp || isSubmittingQuiz}
              className="flex flex-col gap-y-4"
            >
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
                          disabled={!isUserSubmittedAnswer || !canRetake || isAwaitingReview}
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
                      {isAwaitingReview
                        ? t("studentLessonView.tooltip.awaitingReview")
                        : getQuizTooltipText(
                            isUserSubmittedAnswer,
                            canRetake,
                            hoursLeft,
                            lesson.quizCooldownInHours,
                          )}
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
                  isUserSubmittedAnswer || isAwaitingQuizStart || isSubmittingQuiz || isGraceOver
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
