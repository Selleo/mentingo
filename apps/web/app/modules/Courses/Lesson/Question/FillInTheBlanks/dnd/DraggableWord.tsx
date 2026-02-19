import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "~/lib/utils";
import { useQuizContext } from "~/modules/Courses/components/QuizContextProvider";

import type { DndWord } from "./types";

type DraggableWordProps = {
  word: DndWord;
  isOverlay?: boolean;
  isCorrect?: boolean | null;
  isStudentAnswer?: boolean;
  stretchToContainer?: boolean;
};

export const DraggableWord = ({
  word,
  isOverlay,
  isCorrect,
  isStudentAnswer,
  stretchToContainer,
}: DraggableWordProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: word.id,
    disabled: !!isStudentAnswer,
  });
  const { isQuizFeedbackRedacted, isQuizSubmitted } = useQuizContext();

  const wordStyle = {
    transform: CSS.Transform?.toString(transform),
    ...(stretchToContainer
      ? {
          transitionDuration: "340ms",
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        }
      : null),
  };

  const quizWordStyle = cn("px-2 py-1 rounded-md text-black", {
    "bg-neutral-200": isQuizFeedbackRedacted && isQuizSubmitted,
    "bg-primary-200": !isQuizFeedbackRedacted && !isCorrect && !isStudentAnswer,
    "bg-success-200": !isQuizFeedbackRedacted && isCorrect && isStudentAnswer,
    "bg-error-200":
      !isQuizFeedbackRedacted &&
      ((!isCorrect && isStudentAnswer) || (isCorrect && !isStudentAnswer)),
  });

  return (
    <div
      {...listeners}
      {...attributes}
      ref={setNodeRef}
      style={wordStyle}
      className={cn(
        "inline-flex items-center whitespace-nowrap will-change-transform transition-[transform,box-shadow] duration-300 ease-out",
        stretchToContainer ? "h-full w-full justify-center rounded-none" : "w-max",
        !isDragging
          ? quizWordStyle
          : "rounded-md bg-gray-100 px-2 py-1 text-neutral-700 blur-[0.3px]",
        !isDragging && "translate-y-0 scale-100 opacity-100",
        { "-rotate-[6deg]": isOverlay },
      )}
    >
      {word?.studentAnswerText ? word?.studentAnswerText : word.value}
    </div>
  );
};
