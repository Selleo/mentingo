import { useDroppable } from "@dnd-kit/core";
import { rectSwappingStrategy, SortableContext } from "@dnd-kit/sortable";

import { cn } from "~/lib/utils";

import { DraggableWord } from "./DraggableWord";

import type { DndWord } from "./types";

type DndBlankProps = {
  words: DndWord[];
  blankId: string;
  isCorrect?: boolean | null;
  isStudentAnswer?: boolean;
  minWidth?: string;
  className?: string;
  wrapText?: boolean;
};

export const DndBlank = ({
  words,
  blankId,
  isCorrect,
  isStudentAnswer,
  minWidth,
  className,
  wrapText,
}: DndBlankProps) => {
  const { setNodeRef } = useDroppable({
    id: blankId,
    data: {
      blankId,
    },
  });

  return (
    <SortableContext id={blankId} items={words.map(({ id }) => id)} strategy={rectSwappingStrategy}>
      <div
        data-testid={blankId}
        ref={setNodeRef}
        style={minWidth ? { minWidth } : undefined}
        className={cn(
          "mx-2 inline-flex h-9 align-middle items-stretch overflow-hidden rounded-md border bg-white",
          className,
        )}
      >
        {words.map((word) => (
          <DraggableWord
            key={word.id}
            word={word}
            isCorrect={isCorrect}
            isStudentAnswer={isStudentAnswer}
            stretchToContainer
            wrapText={wrapText}
          />
        ))}
      </div>
    </SortableContext>
  );
};
