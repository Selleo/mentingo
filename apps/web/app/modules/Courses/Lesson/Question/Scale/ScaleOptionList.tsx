import { useState, useEffect, useCallback } from "react";
import { useFormContext } from "react-hook-form";

import { Icon } from "~/components/Icon";
import { SortableList } from "~/components/SortableList";

import type { QuizQuestionOption } from "../types";
import type { QuizForm } from "~/modules/Courses/Lesson/types";

type ScaleOptionListProps = {
  options: QuizQuestionOption[];
  questionId: string;
  isCompleted: boolean;
};

const shuffleScaleOptions = (options: QuizQuestionOption[]) => {
  return options.sort(() => Math.random() - 0.5);
};

export const ScaleOptionList = ({ options, questionId }: ScaleOptionListProps) => {
  const { setValue } = useFormContext<QuizForm>();

  const shuffledOptions = shuffleScaleOptions(options);
  const itemsWithSortableId = shuffledOptions.map((option) => ({
    ...option,
    sortableId: option.id,
  }));

  const [sortableOptions, setSortableOptions] = useState(itemsWithSortableId);

  const updateFormValue = useCallback(
    (updatedOptions: typeof itemsWithSortableId) => {
      const answerIds = updatedOptions.map((option) => option.id);

      setValue(`scaleQuestions.${questionId}`, answerIds, { shouldDirty: true });
    },
    [setValue, questionId],
  );

  useEffect(() => {
    updateFormValue(itemsWithSortableId);
  }, [itemsWithSortableId, updateFormValue]);

  return (
    <SortableList
      items={sortableOptions}
      onChange={(updatedItems) => {
        setSortableOptions(updatedItems);
        updateFormValue(updatedItems);
      }}
      renderItem={(item, index) => {
        return (
          <SortableList.Item id={item.sortableId}>
            <div
              key={index}
              className="mt-2 flex items-center space-x-2 rounded-xl border border-neutral-200 p-2 pr-3"
            >
              <SortableList.DragHandle>
                <Icon name="DragAndDropIcon" className="ml-4 mr-3 cursor-move" />
              </SortableList.DragHandle>
              <span>{item.optionText}</span>
            </div>
          </SortableList.Item>
        );
      }}
    ></SortableList>
  );
};
