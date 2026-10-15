import { useRichTextMediaUrl } from "~/components/RichText/contentPolicyContext";
import { useCourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";

import { QuestionCard } from "../QuestionCard";
import { SingleChoiceOptionList } from "../SingleChoice/SingleChoiceOptionList";

import type { QuizQuestion } from "../types";

type PhotoQuestionSingleChoiceProps = {
  question: QuizQuestion;
  isCompleted?: boolean;
};

export const PhotoQuestionSingleChoice = ({
  question,
  isCompleted = false,
}: PhotoQuestionSingleChoiceProps) => {
  const { isPreviewMode } = useCourseAccessProvider();

  const safePhotoUrl = useRichTextMediaUrl(
    question.photoS3Key || "https://placehold.co/960x620/png",
  );
  return (
    <QuestionCard
      title={question.title}
      questionType="singleChoice"
      questionNumber={question.displayOrder}
      data-testid="photo-question-single-choice"
    >
      {safePhotoUrl && (
        <img src={safePhotoUrl} alt="" className="h-auto w-full max-w-[960px] rounded-lg" />
      )}
      <SingleChoiceOptionList
        options={question.options || []}
        questionId={question.id}
        isPreviewMode={isPreviewMode}
        isCompleted={isCompleted}
        withPicture
      />
    </QuestionCard>
  );
};
