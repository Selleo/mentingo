import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useLesson } from "~/api/queries";
import { useUserById } from "~/api/queries/admin/useUserById";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { CircularProgress } from "~/components/ui/circular-progress";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { LessonType } from "~/modules/Admin/EditCourse/EditCourse.types";
import { LessonContent } from "~/modules/Courses/Lesson/LessonContent";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import type { GetCourseResponse } from "~/api/generated-api";

interface LessonPreviewDialogProps {
  course: GetCourseResponse["data"];
  lessonId: string;
  userId: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function LessonPreviewDialog({
  course,
  lessonId,
  userId,
  isOpen,
  onClose,
}: LessonPreviewDialogProps) {
  const { t } = useTranslation();

  const { language } = useLanguageStore();

  const { data: user, isLoading: isLoadingUser } = useUserById(userId);
  const { data: lesson, isLoading: isLoadingLesson } = useLesson(lessonId, language, userId);

  useEffect(() => {
    if (!isLoadingUser && !isLoadingLesson && (!user || !lesson || !course)) {
      onClose?.();
    }
  }, [user, lesson, isLoadingUser, isLoadingLesson, onClose, course]);

  if (!user || !lesson || !course) {
    return null;
  }

  const currentChapter = course.chapters.find((chapter) =>
    chapter?.lessons.some((l) => l.id === lessonId),
  );

  const isAiMentorLesson = lesson.type === LessonType.AI_MENTOR;

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
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
          <Button size="icon" variant="outline" onClick={onClose}>
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
          </div>
          <LessonContent
            lesson={lesson}
            course={course}
            lessonsAmount={currentChapter?.lessons.length ?? 0}
            handleNext={() => {}}
            handlePrevious={() => {}}
            isLastLesson={true}
            isFirstLesson={true}
            lessonLoading={isLoadingLesson}
            isPreviewMode={true}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
