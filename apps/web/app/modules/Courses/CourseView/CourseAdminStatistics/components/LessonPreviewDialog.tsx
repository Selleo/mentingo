import { BookOpen, CheckCircle2, ClipboardCheck, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useLesson } from "~/api/queries";
import { useUserById } from "~/api/queries/admin/useUserById";
import { Icon } from "~/components/Icon";
import Viewer from "~/components/RichText/Viever";
import { Button } from "~/components/ui/button";
import { CircularProgress } from "~/components/ui/circular-progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { cn } from "~/lib/utils";
import { LessonType } from "~/modules/Admin/EditCourse/EditCourse.types";
import { CourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";
import { AiMentorEvaluationDialog } from "~/modules/Courses/Lesson/AiMentorLesson/components/AiMentorEvaluationDialog";
import { LessonContent } from "~/modules/Courses/Lesson/LessonContent";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { COURSE_STATISTICS_HANDLES } from "../../../../../../e2e/data/statistics/handles";

import type { GetCourseResponse } from "~/api/generated-api";
import type { AiMentorEvaluation } from "~/modules/Courses/Lesson/AiMentorLesson/components/AiMentorEvaluationDialog.types";

interface LessonPreviewDialogProps {
  course: GetCourseResponse["data"];
  lessonId: string;
  userId: string;
  isOpen?: boolean;
  onClose?: () => void;
}

const hasEvaluationData = (evaluation?: AiMentorEvaluation | null) =>
  Boolean(
    evaluation &&
      (typeof evaluation.passed === "boolean" ||
        evaluation.score != null ||
        evaluation.summary?.trim().length),
  );

export default function LessonPreviewDialog({
  course,
  lessonId,
  userId,
  isOpen,
  onClose,
}: LessonPreviewDialogProps) {
  const { t } = useTranslation();
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showEvaluationDialog, setShowEvaluationDialog] = useState(false);

  const { language } = useLanguageStore();

  const { data: user, isLoading: isLoadingUser } = useUserById(userId);
  const { data: lesson, isLoading: isLoadingLesson } = useLesson(lessonId, language, userId);

  useEffect(() => {
    if (!isLoadingUser && !isLoadingLesson && (!user || !lesson || !course)) {
      onClose?.();
    }
  }, [user, lesson, isLoadingUser, isLoadingLesson, onClose, course]);

  const isAiMentorLesson = lesson?.type === LessonType.AI_MENTOR;
  const hasTaskDescription = Boolean(lesson?.description && lesson.description.trim().length > 0);
  const aiMentorDetails = lesson?.aiMentorDetails;
  const aiMentorEvaluation = useMemo<AiMentorEvaluation | null>(() => {
    if (!isAiMentorLesson || !aiMentorDetails) return null;

    return {
      summary: aiMentorDetails.summary,
      passed: aiMentorDetails.passed,
      minScore: aiMentorDetails.minScore,
      score: aiMentorDetails.score,
      maxScore: aiMentorDetails.maxScore,
      percentage: aiMentorDetails.percentage,
      requiredScore: aiMentorDetails.requiredScore,
    };
  }, [aiMentorDetails, isAiMentorLesson]);
  const shouldShowEvaluation = hasEvaluationData(aiMentorEvaluation);

  if (!user || !lesson || !course) {
    return null;
  }

  const currentChapter = course.chapters.find((chapter) =>
    chapter?.lessons.some((l) => l.id === lessonId),
  );

  const scorePercentage = isAiMentorLesson
    ? (lesson.aiMentorDetails?.percentage ?? 0)
    : (lesson.quizDetails?.score ?? 0);

  const score = isAiMentorLesson
    ? (lesson.aiMentorDetails?.score ?? 0)
    : (lesson.quizDetails?.correctAnswerCount ?? 0);

  const thresholdPercentage = isAiMentorLesson
    ? (lesson.aiMentorDetails?.requiredScore ?? 0)
    : (lesson.thresholdScore ?? 0);

  const maxScore = isAiMentorLesson
    ? (lesson.aiMentorDetails?.maxScore ?? 0)
    : (lesson.quizDetails?.questionCount ?? 0);

  const requiredCorrectAnswers = isAiMentorLesson
    ? Math.ceil((thresholdPercentage * maxScore) / 100)
    : Math.ceil((thresholdPercentage * maxScore) / 100);

  const { firstName, lastName, profilePictureUrl } = user;

  return (
    <TooltipProvider delayDuration={0}>
      {aiMentorEvaluation && (
        <AiMentorEvaluationDialog
          evaluation={aiMentorEvaluation}
          open={showEvaluationDialog}
          onOpenChange={setShowEvaluationDialog}
        />
      )}
      {isAiMentorLesson && hasTaskDescription && (
        <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
          <DialogContent className="flex max-h-[82vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
            <DialogHeader className="border-b border-neutral-100 px-6 py-4 text-left">
              <DialogTitle className="text-lg font-semibold text-neutral-950">
                {t("studentCourseView.lesson.aiMentorLesson.taskButton")}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {t("studentCourseView.lesson.aiMentorLesson.taskDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 px-6 py-5">
              <div className="max-h-[62vh] overflow-y-auto pr-2 text-left text-sm leading-relaxed text-neutral-800">
                <Viewer content={lesson.description ?? ""} />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          data-testid={COURSE_STATISTICS_HANDLES.LESSON_PREVIEW_DIALOG}
          className="max-h-[90vh] w-[90%] max-w-screen-2xl 3xl:max-w-[1024px] p-0 gap-0 flex flex-col"
          noCloseButton
        >
          <DialogTitle className="px-6 sm:px-10 3xl:px-8 flex items-center justify-between border-b sticky top-0 left-0 pb-4 bg-white z-10 py-6 border-neutral-200">
            <div className="w-full">
              <span className="h4 truncate">{lesson.title}</span>
              <p className="h6 text-neutral-950">
                <span className="text-neutral-800">
                  {t("studentLessonView.other.chapter")} {currentChapter?.displayOrder}:
                </span>{" "}
                {currentChapter?.title}
              </p>
            </div>
            <Button
              data-testid={COURSE_STATISTICS_HANDLES.LESSON_PREVIEW_CLOSE_BUTTON}
              size="icon"
              variant="outline"
              onClick={onClose}
            >
              <Icon name="X" className="size-4" />
            </Button>
          </DialogTitle>
          <div className="pt-6 pb-10 overflow-y-auto">
            <div className="flex items-center justify-between px-10 pb-6">
              <div className="flex items-center gap-4">
                <UserAvatar
                  className="size-8"
                  userName={user.firstName}
                  profilePictureUrl={user.profilePictureUrl}
                />
                <p className="h6">
                  {user.firstName} {user.lastName}
                </p>
              </div>
              {!isAiMentorLesson && (
                <div className="flex items-center gap-3">
                  <CircularProgress size={40} strokeWidth={4} value={scorePercentage ?? 0} />
                  <div className="flex flex-col">
                    <span className="group relative">
                      {t("studentLessonView.other.score", {
                        score: scorePercentage,
                        correct: score,
                        questionsNumber: maxScore,
                      })}
                    </span>
                    <span>
                      {t("studentLessonView.other.passingThreshold", {
                        threshold: thresholdPercentage,
                        correct: requiredCorrectAnswers,
                        questionsNumber: maxScore,
                      })}
                    </span>
                  </div>
                </div>
              )}
            </div>
            {isAiMentorLesson && (
              <div className="grid w-full grid-cols-2 gap-2 px-10 pb-6">
                <Button
                  data-testid={COURSE_STATISTICS_HANDLES.LESSON_PREVIEW_TASK_DESCRIPTION_BUTTON}
                  type="button"
                  variant="outline"
                  className="h-9 min-w-0 justify-center gap-2 rounded-md border-neutral-200 bg-white px-2 text-xs font-medium text-neutral-800 shadow-none hover:border-primary-200 hover:bg-primary-50 hover:text-primary-800 sm:text-sm"
                  disabled={!hasTaskDescription}
                  onClick={() => setShowTaskDialog(true)}
                >
                  <BookOpen className="size-4 shrink-0" />
                  <span className="truncate">
                    {t("studentCourseView.lesson.aiMentorLesson.taskButton")}
                  </span>
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="min-w-0">
                      <Button
                        data-testid={COURSE_STATISTICS_HANDLES.LESSON_PREVIEW_RESULT_BUTTON}
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-9 w-full min-w-0 justify-center gap-2 rounded-md border-neutral-200 bg-white px-2 text-xs font-medium text-neutral-800 shadow-none hover:border-primary-200 hover:bg-primary-50 hover:text-primary-800 disabled:pointer-events-none disabled:text-neutral-400 sm:text-sm",
                          {
                            "border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800":
                              aiMentorEvaluation?.passed === true,
                            "border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800":
                              aiMentorEvaluation?.passed === false,
                          },
                        )}
                        disabled={!shouldShowEvaluation}
                        onClick={() => setShowEvaluationDialog(true)}
                      >
                        {aiMentorEvaluation?.passed === true ? (
                          <CheckCircle2 className="size-4 shrink-0" />
                        ) : aiMentorEvaluation?.passed === false ? (
                          <XCircle className="size-4 shrink-0" />
                        ) : (
                          <ClipboardCheck className="size-4 shrink-0" />
                        )}
                        <span className="truncate">
                          {t("studentCourseView.lesson.aiMentorLesson.resultButton")}
                        </span>
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!shouldShowEvaluation && (
                    <TooltipContent
                      side="bottom"
                      align="center"
                      className="rounded bg-black px-2 py-1 text-sm text-white shadow-md"
                    >
                      {t("studentCourseView.lesson.aiMentorLesson.resultButtonDisabledTooltip")}
                      <TooltipArrow className="fill-black" />
                    </TooltipContent>
                  )}
                </Tooltip>
              </div>
            )}
            <CourseAccessProvider course={course} forcePreviewMode>
              <LessonContent
                lesson={lesson}
                course={course}
                hideControls={isAiMentorLesson}
                previewUser={{
                  firstName,
                  lastName,
                  profilePictureUrl,
                }}
                lessonsAmount={currentChapter?.lessons.length ?? 0}
                handleNext={() => {}}
                handlePrevious={() => {}}
                isLastLesson={true}
                isFirstLesson={true}
                lessonLoading={isLoadingLesson}
              />
            </CourseAccessProvider>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
