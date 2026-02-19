import { useDroppable } from "@dnd-kit/core";
import { rectSwappingStrategy, SortableContext } from "@dnd-kit/sortable";

import { DraggableWord } from "./DraggableWord";

import type { DndWord } from "./types";

type DndBlankProps = {
  words: DndWord[];
  blankId: string;
  isCorrect?: boolean | null;
  isStudentAnswer?: boolean;
  minWidth?: string;
};

export const DndBlank = ({
  words,
  blankId,
  isCorrect,
  isStudentAnswer,
  minWidth,
}: DndBlankProps) => {
  const { setNodeRef } = useDroppable({
    id: blankId,
  });

  return (
    <SortableContext id={blankId} items={words.map(({ id }) => id)} strategy={rectSwappingStrategy}>
      <div
        data-testid={blankId}
        ref={setNodeRef}
        style={minWidth ? { minWidth } : undefined}
        className="mx-2 inline-flex min-h-9 items-stretch overflow-hidden rounded-md border bg-white"
      >
        {words.map((word) => (
          <DraggableWord
            key={word.id}
            word={word}
            isCorrect={isCorrect}
            isStudentAnswer={isStudentAnswer}
            stretchToContainer
          />
        ))}
      </div>
    </SortableContext>
  );
};
