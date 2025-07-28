import { X } from "lucide-react";

import { useLesson } from "~/api/queries";
import { Button } from "~/components/ui/button";
import AiMentorLesson from "~/modules/Courses/Lesson/AiMentorLesson/AiMentorLesson";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import type { Lesson } from "~/modules/Admin/EditCourse/EditCourse.types";

interface AiMentorPreviewProps {
  onClose: () => void;
  lesson: Lesson;
}

const AiMentorLessonPreview = ({ onClose, lesson }: AiMentorPreviewProps) => {
  const { language } = useLanguageStore();
  const { data: lessonData, isFetching: lessonLoading } = useLesson(lesson.id, language);

  return (
    <div className="fixed left-0 top-0 z-[100] box-border flex size-full max-h-dvh justify-center bg-gray-900/50 p-4">
      <div className="flex w-full max-w-6xl flex-col">
        <div className="flex items-center justify-between rounded-t-lg bg-white p-4">
          <div>
            <h2 className="font-medium text-blue-800">{lesson.title}</h2>
            <h2 className="text-sm text-gray-400">AI Mentor</h2>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex h-8 w-8 items-center justify-center p-0 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="size-5" />
            </Button>
          </div>
        </div>
        <div className="box-border flex flex-1 rounded-b-lg bg-neutral-50 p-4">
          {lessonData && <AiMentorLesson lesson={lessonData} lessonLoading={lessonLoading} />}
        </div>
      </div>
    </div>
  );
};

export default AiMentorLessonPreview;
