import { BriefResponse } from "./BriefResponse";
import { DetailedResponse } from "./DetailedResponse";
import { FillInTheBlanksDnd } from "./FillInTheBlanks/dnd/FillInTheBlanksDnd";
import { FillInTheBlanks } from "./FillInTheBlanks/FillInTheBlanks";
import { MultipleChoice } from "./MultipleChoice";
import { PhotoQuestionMultipleChoice } from "./PhotoQuestionMultipleChoice";
import { PhotoQuestionSingleChoice } from "./PhotoQuestionSingleChoice";
import { SingleChoice } from "./SingleChoice/SingleChoice";
import { TrueOrFalse } from "./TrueOrFalse";

import type { QuizQuestion } from "./types";

type QuestionProps = {
  question: QuizQuestion;
  isSubmitted?: boolean;
  isCompleted: boolean;
  lessonId: string;
};

export const Question = ({ question, isCompleted, lessonId }: QuestionProps) => {
  if (!lessonId) throw new Error("Lesson ID not found");

  const isTrueOrFalse = question.type === "true_or_false";
  const isSingleQuestion = question.type === "single_choice";
  const isMultiQuestion = question.type === "multiple_choice";
  const isPhotoQuestionSingleChoice = question.type === "photo_question_single_choice";
  const isPhotoQuestionMultipleChoice = question.type === "photo_question_multiple_choice";
  const isBriefResponse = question.type === "brief_response";
  const isDetailedResponse = question.type === "detailed_response";
  const isTextFillInTheBlanks = question.type === "fill_in_the_blanks_text";
  const isDraggableFillInTheBlanks = question.type === "fill_in_the_blanks_dnd";

  switch (true) {
    case isBriefResponse:
      return <BriefResponse question={question} isCompleted={isCompleted} />;

    case isDetailedResponse:
      return <DetailedResponse question={question} isCompleted={isCompleted} />;

    case isTextFillInTheBlanks:
      return <FillInTheBlanks question={question} isCompleted={isCompleted} />;

    case isDraggableFillInTheBlanks:
      return <FillInTheBlanksDnd question={question} isCompleted={isCompleted} />;

    case isSingleQuestion:
      return <SingleChoice question={question} isCompleted={isCompleted} />;

    case isMultiQuestion:
      return <MultipleChoice question={question} isCompleted={isCompleted} />;

    case isPhotoQuestionSingleChoice:
      return <PhotoQuestionSingleChoice question={question} isCompleted={isCompleted} />;

    case isPhotoQuestionMultipleChoice:
      return <PhotoQuestionMultipleChoice question={question} isCompleted={isCompleted} />;

    case isTrueOrFalse:
      return <TrueOrFalse question={question} isCompleted={isCompleted} />;

    default:
      return null;
  }
};
