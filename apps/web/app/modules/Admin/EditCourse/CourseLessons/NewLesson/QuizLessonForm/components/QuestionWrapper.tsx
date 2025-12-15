import { Accordion, AccordionContent, AccordionItem } from "~/components/ui/accordion";
import { cn } from "~/lib/utils";

import { QuestionType } from "../QuizLessonForm.types";

import QuestionTitle from "./QuestionTitle";

import type { Question } from "../QuizLessonForm.types";
import type { QuizLessonFormValues } from "../validators/quizLessonFormSchema";
import type React from "react";
import type { UseFormReturn } from "react-hook-form";

const QuestionWrapper = ({
  questionType,
  questionIndex,
  form,
  dragTrigger,
  children,
  item,
  isOpen,
  handleToggle,
  isStructureLocked = false,
}: {
  questionType: QuestionType;
  questionIndex: number;
  form: UseFormReturn<QuizLessonFormValues>;
  dragTrigger: React.ReactNode;
  children: React.ReactNode;
  item: Question;
  isOpen: boolean;
  handleToggle: () => void;
  isStructureLocked?: boolean;
}) => {
  const isOpenQuestion =
    questionType === QuestionType.BRIEF_RESPONSE || questionType === QuestionType.DETAILED_RESPONSE;

  const errors = form.formState.errors;

  errors?.questions?.[questionIndex];
  return (
    <Accordion type="single" collapsible value={isOpen ? `item-${item.sortableId}` : undefined}>
      <AccordionItem value={`item-${item.sortableId}`}>
        <div
          className={cn(
            "mt-4 rounded-xl border p-2 transition-all duration-300",
            errors?.questions?.[questionIndex]
              ? "border-red-500"
              : isOpen && !isOpenQuestion
                ? "border-primary-500"
                : "border-gray-200",
          )}
        >
          <QuestionTitle
            questionIndex={questionIndex}
            questionType={questionType}
            form={form}
            isOpen={isOpen}
            handleToggle={handleToggle}
            dragTrigger={dragTrigger}
            item={item}
            isOpenQuestion={isOpenQuestion}
            isStructureLocked={isStructureLocked}
          />
          {isOpen && <AccordionContent>{children}</AccordionContent>}
        </div>
      </AccordionItem>
    </Accordion>
  );
};

export default QuestionWrapper;
