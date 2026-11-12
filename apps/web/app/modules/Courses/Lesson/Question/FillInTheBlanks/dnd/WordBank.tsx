import { useDroppable } from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { useTranslation } from "react-i18next";

import { DraggableWord } from "./DraggableWord";

import type { DndWord } from "./types";

type WordBankProps = {
  words: DndWord[];
  wrapText?: boolean;
};

export const WordBank = ({ words, wrapText }: WordBankProps) => {
  const { setNodeRef } = useDroppable({
    id: "blank_preset",
    data: {
      blankId: "blank_preset",
    },
  });

  const renderDraggableWords = () => {
    return words.map((word) => {
      const updatedWord =
        word.value !== word.studentAnswerText ? { ...word, studentAnswerText: word.value } : word;

      return <DraggableWord key={word.id} word={updatedWord ?? word} wrapText={wrapText} />;
    });
  };
  const { t } = useTranslation();

  const draggableWords = renderDraggableWords();

  return (
    <SortableContext
      id="blank_preset"
      items={words.map(({ id }) => id)}
      strategy={horizontalListSortingStrategy}
    >
      <div className="mt-5">
        {t("studentLessonView.other.answers")}
        <div
          ref={setNodeRef}
          data-testid="blank_preset"
          className="flex min-h-12 min-w-20 flex-wrap items-center gap-2 rounded-lg"
        >
          {draggableWords}
        </div>
      </div>
    </SortableContext>
  );
};
