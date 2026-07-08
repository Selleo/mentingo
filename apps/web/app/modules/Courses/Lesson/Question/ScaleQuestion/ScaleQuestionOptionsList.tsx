import { useState, useEffect } from "react";
import { useFormContext } from "react-hook-form";

import type { QuizQuestionOption } from "../types";

type ScaleQuestionOptionsListProps = {
  options: QuizQuestionOption[];
  questionId: string;
  isCompleted: boolean;
  isPreviewMode: boolean;
};

export const ScaleQuestionOptionsList = ({
  options,
  questionId,
  isCompleted,
  isPreviewMode,
}: ScaleQuestionOptionsListProps) => {
  const { setValue, getValues } = useFormContext();
  const optionFieldId = "singleAnswerQuestions";

  const visibleOptions = options.slice(0, 5);
  const totalSteps = visibleOptions.length;

  const studentAnswerIndex = visibleOptions.findIndex((o) => Boolean(o.isStudentAnswer));

  const [currentIndex, setCurrentIndex] = useState<number>(
    studentAnswerIndex !== -1 ? studentAnswerIndex : 0,
  );

  useEffect(() => {
    if (studentAnswerIndex !== -1) {
      setCurrentIndex(studentAnswerIndex);
    }
  }, [studentAnswerIndex]);

  const isDisabled = isCompleted || isPreviewMode;

  const updateFormValue = (selectedIndex: number) => {
    const selectedOption = visibleOptions[selectedIndex];
    if (!selectedOption) return;

    const updatedAnswers = visibleOptions.reduce<Record<string, string | null>>((acc, option) => {
      if (option.id === selectedOption.id) {
        acc[option.id] = option.id;
      } else {
        acc[option.id] = null;
      }
      return acc;
    }, {});

    setValue(`${optionFieldId}.${questionId}`, updatedAnswers, { shouldDirty: true });
  };

  useEffect(() => {
    if (!isDisabled) {
      const currentFormValues = getValues(`${optionFieldId}.${questionId}`);
      if (!currentFormValues) {
        updateFormValue(studentAnswerIndex !== -1 ? studentAnswerIndex : 0);
      }
    }
  }, [questionId, studentAnswerIndex, isDisabled]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isDisabled) return;

    const newIndex = parseInt(e.target.value, 10);
    setCurrentIndex(newIndex);

    updateFormValue(newIndex);
  };

  return (
    <div className="w-full  px-4 py-6 flex flex-col gap-4">
      <div className="relative  w-full flex items-center">
        <input
          type="range"
          min="0"
          max={totalSteps - 1}
          step="1"
          value={currentIndex}
          disabled={isDisabled}
          onChange={handleChange}
          className={`
            w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer 
            accent-blue-600 focus:outline-none transition-all
            ${isDisabled ? "opacity-60 cursor-not-allowed accent-gray-500" : "hover:bg-gray-300"}
          `}
          style={{ WebkitAppearance: "none" }}
        />
      </div>

      <div className="flex justify-between w-full px-[6px] text-sm font-medium">
        {visibleOptions.map((option, index) => {
          const isSelected = currentIndex === index;
          return (
            <div
              key={option.id}
              className="flex flex-col items-center w-0 justify-center overflow-visible"
            >
              <span
                className={`
                text-center transition-all duration-150 select-none 
                ${isSelected ? "text-blue-600 font-bold scale-105" : "text-gray-500"}
              `}
              >
                {option.optionText}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
