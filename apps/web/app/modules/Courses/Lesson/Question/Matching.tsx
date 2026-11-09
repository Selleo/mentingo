import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { uniq } from "lodash-es";
import { useState } from "react";
import { useController } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useQuizContext } from "~/modules/Courses/components/QuizContextProvider";

import { DndBlank, DraggableWord } from "./FillInTheBlanks/dnd";
import { WordBank } from "./FillInTheBlanks/dnd/WordBank";
import { QuestionCard } from "./QuestionCard";

import type { DndWord } from "./FillInTheBlanks/dnd/types";
import type { QuizQuestion } from "./types";
import type {
  CollisionDetection,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import type { QuizForm } from "~/modules/Courses/Lesson/types";

type MatchingProps = {
  question: QuizQuestion;
  isCompleted?: boolean;
};

export type MatchingAnswers = Record<string, string | null>;

// WordBank registers its droppable under this id.
const BANK_ID = "blank_preset";
const WORD_ID_PREFIX = "match:";

/** Moves a match to a pair (or back to the bank), swapping out whatever the pair held. */
export const placeMatch = (
  answers: MatchingAnswers,
  target: string,
  pairId: string | null,
): MatchingAnswers => {
  const fromPairId = Object.keys(answers).find((key) => answers[key] === target);
  if (fromPairId === pairId) return answers;

  const next: MatchingAnswers = { ...answers };
  if (fromPairId) next[fromPairId] = pairId ? (answers[pairId] ?? null) : null;
  if (pairId) next[pairId] = target;

  return next;
};

const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;

  return rectIntersection(args);
};

const resolveDropId = (over: DragEndEvent["over"] | DragOverEvent["over"]) => {
  if (!over) return null;

  return String(over.data.current?.blankId ?? over.data.current?.sortable?.containerId ?? over.id);
};

export const Matching = ({ question, isCompleted = false }: MatchingProps) => {
  const { t } = useTranslation();
  const { isQuizFeedbackRedacted } = useQuizContext();
  const { field } = useController<QuizForm>({ name: `matchingQuestions.${question.id}` });
  const [draggedTarget, setDraggedTarget] = useState<string | null>(null);
  const [previewDropId, setPreviewDropId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: isCompleted ? Infinity : 0 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: isCompleted ? [] : ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );

  const answers = (field.value ?? {}) as MatchingAnswers;
  // Empty matches come from untranslated pairs and cannot be placed.
  const targets = uniq(question.matchingTargets ?? []).filter(Boolean);
  const pairIds = new Set((question.options ?? []).map(({ id }) => id));
  const isDropId = (id: string | null): id is string =>
    id !== null && (id === BANK_ID || pairIds.has(id));

  const renderedAnswers =
    draggedTarget && isDropId(previewDropId)
      ? placeMatch(answers, draggedTarget, previewDropId === BANK_ID ? null : previewDropId)
      : answers;
  const placedTargets = new Set(Object.values(renderedAnswers).filter(Boolean));
  const toWord = (target: string, blankId: string): DndWord => ({
    id: `${WORD_ID_PREFIX}${target}`,
    index: null,
    value: target,
    blankId,
  });
  const bankWords = targets
    .filter((target) => !placedTargets.has(target))
    .map((target) => toWord(target, BANK_ID));

  const resetDrag = () => {
    setDraggedTarget(null);
    setPreviewDropId(null);
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    if (isCompleted) return;
    const target = String(active.id).slice(WORD_ID_PREFIX.length);
    if (targets.includes(target)) setDraggedTarget(target);
  };

  const handleDragOver = ({ over }: DragOverEvent) => {
    const dropId = resolveDropId(over);
    if (isDropId(dropId)) setPreviewDropId(dropId);
  };

  const handleDragEnd = ({ over }: DragEndEvent) => {
    const dropId = resolveDropId(over);
    if (draggedTarget && isDropId(dropId)) {
      field.onChange(placeMatch(answers, draggedTarget, dropId === BANK_ID ? null : dropId));
    }
    resetDrag();
  };

  return (
    <QuestionCard
      title={question.title ?? ""}
      questionType="matching"
      questionNumber={question.displayOrder ?? 0}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragCancel={resetDrag}
        onDragEnd={handleDragEnd}
      >
        <DragOverlay dropAnimation={null}>
          {draggedTarget && (
            <DraggableWord word={toWord(draggedTarget, BANK_ID)} isOverlay wrapText />
          )}
        </DragOverlay>
        {question.options?.map(({ id, optionText, isCorrect, matchedWord, studentAnswer }) => {
          const answer = isCompleted ? studentAnswer : renderedAnswers[id];
          const words: DndWord[] = answer
            ? [
                {
                  ...toWord(answer, id),
                  id: isCompleted ? `answer:${id}` : `${WORD_ID_PREFIX}${answer}`,
                },
              ]
            : [];

          return (
            <div
              key={id}
              data-testid={`matching-pair-${id}`}
              className="body-base flex flex-col gap-2 rounded-lg border border-neutral-200 px-4 py-3 text-neutral-950 sm:flex-row sm:items-center"
            >
              <span id={`matching-${id}`} className="w-full min-w-0 [overflow-wrap:anywhere]">
                {optionText}
              </span>
              <div className="flex w-full min-w-0 flex-col gap-1">
                <DndBlank
                  blankId={id}
                  words={words}
                  isCorrect={isCorrect}
                  isStudentAnswer={Boolean(answer)}
                  className="mx-0 flex h-auto min-h-9 w-full"
                  wrapText
                />
                {isCompleted && !isQuizFeedbackRedacted && !isCorrect && matchedWord && (
                  <span className="body-sm text-neutral-800 [overflow-wrap:anywhere]">
                    {t("studentLessonView.other.correctMatch")} {matchedWord}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {!isCompleted && targets.length === 0 && (
          <span className="body-sm text-neutral-600">
            {t("studentLessonView.other.noMatchesAvailable")}
          </span>
        )}
        {!isCompleted && targets.length > 0 && <WordBank words={bankWords} wrapText />}
      </DndContext>
    </QuestionCard>
  );
};
