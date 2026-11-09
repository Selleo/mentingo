import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { uniq } from "lodash-es";
import { useState } from "react";
import { useController } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { cn } from "~/lib/utils";
import { useQuizContext } from "~/modules/Courses/components/QuizContextProvider";

import { QuestionCard } from "./QuestionCard";

import type { QuizQuestion } from "./types";
import type { DragEndEvent } from "@dnd-kit/core";
import type { QuizForm } from "~/modules/Courses/Lesson/types";

type MatchingProps = {
  question: QuizQuestion;
  isCompleted?: boolean;
};

type Answers = Record<string, string | null>;

const POOL_ID = "matching-pool";

type DraggableMatchProps = {
  id: string;
  target: string;
  disabled: boolean;
  isSelected?: boolean;
  onClick?: () => void;
};

const DraggableMatch = ({ id, target, disabled, isSelected, onClick }: DraggableMatchProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { target },
    disabled,
  });

  return (
    <button
      {...listeners}
      {...attributes}
      // Keyboard users place matches by pressing them, so dnd-kit's drag instructions do not apply.
      aria-describedby={undefined}
      ref={setNodeRef}
      type="button"
      disabled={disabled}
      aria-pressed={isSelected}
      onClick={onClick}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "body-base min-w-0 max-w-full touch-none [overflow-wrap:anywhere] rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-left text-neutral-950 disabled:cursor-default",
        {
          "cursor-grab": !disabled,
          "relative z-10 shadow-lg": isDragging,
          "border-primary-700 ring-2 ring-primary-200": isSelected,
        },
      )}
    >
      {target}
    </button>
  );
};

type DropZoneProps = {
  id: string;
  disabled: boolean;
  className?: string;
  children: React.ReactNode;
};

const DropZone = ({ id, disabled, className, children }: DropZoneProps) => {
  const { setNodeRef, isOver } = useDroppable({ id, disabled });

  return (
    <div ref={setNodeRef} className={cn(className, { "bg-primary-50": isOver })}>
      {children}
    </div>
  );
};

export const Matching = ({ question, isCompleted = false }: MatchingProps) => {
  const { t } = useTranslation();
  const { isQuizFeedbackRedacted, isQuizSubmitted } = useQuizContext();
  const { field } = useController<QuizForm>({ name: `matchingQuestions.${question.id}` });
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  const answers = (field.value ?? {}) as Answers;
  // Empty matches come from untranslated pairs and cannot be answered.
  const targets = uniq(question.matchingTargets ?? []).filter(Boolean);
  const usedTargets = new Set(Object.values(answers).filter(Boolean));
  const poolTargets = targets.filter((target) => !usedTargets.has(target));
  const showFeedback = isCompleted && !isQuizFeedbackRedacted;

  // Each match is used once: placing it clears its previous pair and swaps out the pair's old match.
  const placeTarget = (target: string, pairId: string | null) => {
    const fromPairId = Object.keys(answers).find((key) => answers[key] === target);
    const next: Answers = { ...answers };
    if (fromPairId) next[fromPairId] = pairId ? (answers[pairId] ?? null) : null;
    if (pairId) next[pairId] = target;
    field.onChange(next);
    setSelectedTarget(null);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const target = active.data.current?.target;
    if (typeof target !== "string" || !over) return;
    placeTarget(target, over.id === POOL_ID ? null : String(over.id));
  };

  const toggleSelected = (target: string) =>
    setSelectedTarget((current) => (current === target ? null : target));

  return (
    <QuestionCard
      title={question.title ?? ""}
      questionType="matching"
      questionNumber={question.displayOrder ?? 0}
    >
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        {!isCompleted && (
          <DropZone
            id={POOL_ID}
            disabled={isCompleted}
            className="flex min-h-12 flex-wrap gap-2 rounded-lg border border-dashed border-neutral-300 p-3"
          >
            {poolTargets.length === 0 && (
              <span className="body-sm text-neutral-600">
                {targets.length === 0
                  ? t("studentLessonView.other.noMatchesAvailable")
                  : t("studentLessonView.other.allMatchesPlaced")}
              </span>
            )}
            {poolTargets.map((target) => (
              <DraggableMatch
                key={target}
                id={`pool:${target}`}
                target={target}
                disabled={isCompleted}
                isSelected={selectedTarget === target}
                onClick={() => toggleSelected(target)}
              />
            ))}
          </DropZone>
        )}
        {question.options?.map(({ id, optionText, isCorrect, matchedWord }) => {
          const answer = answers[id];

          return (
            <div
              key={id}
              data-testid={`matching-pair-${id}`}
              className={cn(
                "body-base flex flex-col gap-2 rounded-lg border border-neutral-200 px-4 py-3 text-neutral-950 sm:flex-row sm:items-center",
                {
                  "border-neutral-400 bg-neutral-100": isQuizFeedbackRedacted && isQuizSubmitted,
                  "border-success-700 bg-success-50": showFeedback && isCorrect,
                  "border-error-700 bg-error-50": showFeedback && !isCorrect,
                },
              )}
            >
              <span id={`matching-${id}`} className="w-full min-w-0 [overflow-wrap:anywhere]">
                {optionText}
              </span>
              <div className="flex w-full min-w-0 flex-col gap-1">
                <DropZone
                  id={id}
                  disabled={isCompleted}
                  className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-white px-2 py-1"
                >
                  {answer && (
                    <>
                      <DraggableMatch id={`pair:${id}`} target={answer} disabled={isCompleted} />
                      {!isCompleted && (
                        <button
                          type="button"
                          aria-label={t("studentLessonView.other.removeMatch", { match: answer })}
                          onClick={() => placeTarget(answer, null)}
                          className="ml-auto shrink-0 rounded p-1 text-neutral-600 hover:bg-neutral-100"
                        >
                          <Icon name="X" className="size-4" />
                        </button>
                      )}
                    </>
                  )}
                  {!answer && selectedTarget && (
                    <button
                      type="button"
                      aria-labelledby={`matching-${id}`}
                      onClick={() => placeTarget(selectedTarget, id)}
                      className="body-sm w-full min-w-0 [overflow-wrap:anywhere] text-left text-primary-700"
                    >
                      {t("studentLessonView.other.placeMatch", { match: selectedTarget })}
                    </button>
                  )}
                  {!answer && !selectedTarget && (
                    <span className="body-sm text-neutral-600">
                      {t("studentLessonView.other.dropMatch")}
                    </span>
                  )}
                </DropZone>
                {showFeedback && !isCorrect && matchedWord && (
                  <span className="body-sm [overflow-wrap:anywhere] text-neutral-800">
                    {t("studentLessonView.other.correctMatch")} {matchedWord}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </DndContext>
    </QuestionCard>
  );
};
