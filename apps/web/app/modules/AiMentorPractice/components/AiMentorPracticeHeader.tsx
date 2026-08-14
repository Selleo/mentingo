import { BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

import Viewer from "~/components/RichText/Viever";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

import { AI_MENTOR_PRACTICE_HANDLES } from "../../../../e2e/data/ai-mentor-practice/handles";

type AiMentorPracticeHeaderProps = {
  title: string | null;
  taskGoal: string | null;
};

export function AiMentorPracticeHeader({ title, taskGoal }: AiMentorPracticeHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="w-full shrink-0 pb-5">
      <div className="flex flex-col gap-3 border-b border-neutral-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="h3 max-w-3xl text-balance text-neutral-950">
          {title || t("aiMentorPractice.conversationTitle")}
        </h1>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              type="button"
              data-testid={AI_MENTOR_PRACTICE_HANDLES.TASK_BUTTON}
              variant="outline"
              size="sm"
              className="w-fit shrink-0 gap-2 rounded-md border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-800 shadow-none hover:border-primary-200 hover:bg-primary-50 hover:text-primary-800"
            >
              <BookOpen className="size-4" aria-hidden="true" />
              {t("studentCourseView.lesson.aiMentorLesson.taskButton")}
            </Button>
          </DialogTrigger>
          <DialogContent variant="mobileDrawer" className="flex flex-col sm:!max-w-xl">
            <DialogHeader className="border-b border-neutral-100 px-6 py-4 text-left">
              <DialogTitle className="text-lg font-semibold text-neutral-950">
                {t("studentCourseView.lesson.aiMentorLesson.taskDescription")}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {t("studentCourseView.lesson.aiMentorLesson.taskDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="px-6 py-5">
              {taskGoal ? (
                <Viewer content={taskGoal} style="prose" className="body-sm text-neutral-800" />
              ) : (
                <p className="body-sm leading-relaxed text-neutral-800">
                  {t("aiMentorPractice.successGoalFallback")}
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}
