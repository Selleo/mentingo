import {
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { type FC, useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import Viewer from "~/components/RichText/Viever";
import { useQuizContext } from "~/modules/Courses/components/QuizContextProvider";

import { DndBlank } from "./DndBlank";
import { DraggableWord } from "./DraggableWord";
import { SentenceBuilder } from "./SentenceBuilder";
import { WordBank } from "./WordBank";

import type { DndWord } from "./types";
import type { QuizQuestion, QuizQuestionOption } from "../../types";
import type { QuizForm } from "~/modules/Courses/Lesson/types";

type FillInTheBlanksDndProps = {
  question: QuizQuestion;
  isCompleted?: boolean;
};

const getAnswers = (options: QuizQuestionOption[] | undefined) => {
  if (!options?.length) return [];

  const items: DndWord[] = options.map(
    ({ id, optionText, displayOrder, isStudentAnswer, isCorrect, studentAnswer }) => ({
      id,
      index: displayOrder ?? null,
      value: optionText,
      blankId: typeof displayOrder === "number" ? `${displayOrder}` : "blank_preset",
      isCorrect: isCorrect,
      isStudentAnswer,
      studentAnswerText: studentAnswer,
    }),
  );

  return items.reduce<DndWord[]>((acc, item) => {
    if (!acc.some(({ value }) => value === item.value)) {
      acc.push(item);
    }

    return acc;
  }, []);
};

export const FillInTheBlanksDnd: FC<FillInTheBlanksDndProps> = ({ question, isCompleted }) => {
  const { t } = useTranslation();

  const { isQuizFeedbackRedacted } = useQuizContext();
  const { setValue } = useFormContext<QuizForm>();

  const [words, setWords] = useState<DndWord[]>(getAnswers(question.options));
  const [currentlyDraggedWord, setCurrentlyDraggedWord] = useState<DndWord | null>(null);
  const [previewBlankId, setPreviewBlankId] = useState<string | null>(null);
  const wordsBeforeDragRef = useRef<DndWord[] | null>(null);

  const solutionExplanation = question.solutionExplanation;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: isCompleted ? Infinity : 0,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: {
        start: isCompleted ? [] : ["Space"],
        cancel: ["Escape"],
        end: ["Space"],
      },
    }),
  );

  useEffect(() => {
    setWords(getAnswers(question.options));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompleted]);

  if (!question.description) return null;

  const maxAnswersAmount = question.description?.match(/\[word]/g)?.length ?? 0;
  const isValidBlankId = (id: string) => {
    if (id === "blank_preset") return true;
    if (!/^\d+$/.test(id)) return false;

    const value = Number(id);
    return value >= 1 && value <= maxAnswersAmount;
  };

  const resolveOverBlankId = (over: DragEndEvent["over"] | DragOverEvent["over"]) => {
    if (!over) return null;

    const sortableContainerId = over?.data?.current?.sortable?.containerId;
    const candidateId = sortableContainerId ?? over.id;
    const id = String(candidateId);

    return isValidBlankId(id) ? id : null;
  };

  const resetDragState = () => {
    setCurrentlyDraggedWord(null);
    setPreviewBlankId(null);
    wordsBeforeDragRef.current = null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (isCompleted) return;

    const { active } = event;
    const { id: activeId } = active;

    const word = words.find(({ id }) => id === activeId);

    if (!word) return;

    wordsBeforeDragRef.current = words.map((item) => ({ ...item }));
    setCurrentlyDraggedWord(word);
  };

  const buildPreviewWords = (sourceWords: DndWord[]) => {
    if (!previewBlankId || !currentlyDraggedWord) return sourceWords;

    const activeWord = sourceWords.find((word) => word.id === currentlyDraggedWord.id);
    if (!activeWord || activeWord.blankId === previewBlankId) return sourceWords;

    const previewWords = sourceWords.map((word) => ({ ...word }));
    const previewActiveWord = previewWords.find((word) => word.id === currentlyDraggedWord.id);
    if (!previewActiveWord) return sourceWords;

    const occupiedTargetWord = previewWords.find(
      (word) => word.blankId === previewBlankId && word.id !== currentlyDraggedWord.id,
    );
    if (occupiedTargetWord && previewBlankId !== "blank_preset") {
      occupiedTargetWord.blankId = previewActiveWord.blankId;
    }

    previewActiveWord.blankId = previewBlankId;
    return previewWords;
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (isCompleted || !currentlyDraggedWord) return;

    const overBlankId = resolveOverBlankId(event.over);
    if (!overBlankId) {
      setPreviewBlankId(null);
      return;
    }

    const activeWord = words.find((word) => word.id === currentlyDraggedWord.id);
    if (!activeWord || activeWord.blankId === overBlankId) {
      setPreviewBlankId(null);
      return;
    }

    setPreviewBlankId(overBlankId);
  };

  const handleCompletion = () => {};

  const collisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;

    return rectIntersection(args);
  };

  const handleDragCancel = () => {
    if (wordsBeforeDragRef.current) {
      setWords(wordsBeforeDragRef.current);
    }
    resetDragState();
  };

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    const activeId = active?.id;

    if (!activeId) {
      resetDragState();
      return;
    }

    const overBlankId = resolveOverBlankId(over);

    if (!over || !overBlankId) {
      if (wordsBeforeDragRef.current) {
        setWords(wordsBeforeDragRef.current);
      }
      resetDragState();
      return;
    }

    setWords((prev) => {
      const activeWord = prev.find(({ id }) => id === activeId);
      if (!activeWord) return prev;
      const activeBlankId = activeWord.blankId;

      let updatedWords = prev;

      if (activeBlankId !== overBlankId) {
        updatedWords = prev.map((word) => ({ ...word }));
        const updatedActiveWord = updatedWords.find(({ id }) => id === activeId);
        if (!updatedActiveWord) return prev;

        const occupiedTargetWord = updatedWords.find(
          ({ blankId, id }) => blankId === overBlankId && id !== activeId,
        );
        if (occupiedTargetWord && overBlankId !== "blank_preset") {
          occupiedTargetWord.blankId = activeBlankId;
        }

        updatedActiveWord.blankId = overBlankId;
      }

      if (activeBlankId === overBlankId && overBlankId === "blank_preset") {
        const overId = String(over.id);
        const activeWords = updatedWords.filter(({ blankId }) => blankId === activeBlankId);
        const overWord = activeWords.find(({ id }) => id === overId);
        const activeWordInSameContainer = activeWords.find(({ id }) => id === activeId);

        if (activeWordInSameContainer) {
          const activeIndex = activeWords.indexOf(activeWordInSameContainer);
          const overIndex = overWord ? activeWords.indexOf(overWord) : 0;
          const movedInContainer = arrayMove(activeWords, activeIndex, overIndex);
          const movedIds = new Set(movedInContainer.map(({ id }) => id));

          updatedWords = [
            ...movedInContainer,
            ...updatedWords.filter((word) => !movedIds.has(word.id)),
          ];
        }
      }

      const filteredWords = updatedWords
        .filter(({ blankId }) => blankId !== "blank_preset")
        .map((item) => {
          const newIndex = parseInt(item.blankId.match(/\d+$/)?.[0] ?? "0", 10);
          return {
            ...item,
            index: newIndex,
          };
        });

      if (filteredWords.length >= 1 && filteredWords.length <= maxAnswersAmount) {
        const sortedWords = filteredWords.sort((a, b) => a.index - b.index);
        if (sortedWords.length > 0 && sortedWords.length <= maxAnswersAmount) {
          handleCompletion();
        }
      }

      for (const word of updatedWords) {
        if (word.blankId !== "blank_preset") {
          setValue(`fillInTheBlanksDnd.${question.id}.${word.blankId}`, word.value);
        }
      }

      return updatedWords;
    });

    resetDragState();
  }

  const renderedWords = buildPreviewWords(words);
  const renderedWordBankWords = renderedWords.filter(({ studentAnswerText, blankId, value }) => {
    const isBlankPreset = blankId === "blank_preset";
    const isSubmitted = isCompleted;
    const isValuesEqualStudentAnswer = studentAnswerText === value;

    if (isBlankPreset && !isSubmitted) return true;
    if (isValuesEqualStudentAnswer) return false;

    if (isSubmitted) return true;
  });

  return (
    <div className="rounded-lg border bg-card p-8 text-card-foreground shadow-sm select-none touch-none">
      <div className="details uppercase text-primary-700">
        {t("studentLessonView.other.question")} {question.displayOrder}
      </div>
      <div className="h6 my-4 text-neutral-950">{t("studentLessonView.other.fillInTheBlanks")}</div>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        <DragOverlay>
          {currentlyDraggedWord && <DraggableWord word={currentlyDraggedWord} isOverlay />}
        </DragOverlay>
        <SentenceBuilder
          content={question.description}
          replacement={(index) => {
            const blankId = `${index + 1}`;
            const wordsInBlank = renderedWords.filter((word) => word.blankId === blankId);

            return (
              <DndBlank
                blankId={blankId}
                words={wordsInBlank}
                isCorrect={wordsInBlank[0]?.isCorrect}
                isStudentAnswer={!!wordsInBlank[0]?.isStudentAnswer}
              />
            );
          }}
        />
        <WordBank words={renderedWordBankWords} />
        {solutionExplanation && !question.passQuestion && !isQuizFeedbackRedacted && (
          <div className="mt-4">
            <span className="body-base-md text-error-700">
              {t("studentLessonView.other.correctSentence")}
            </span>
            <Viewer content={solutionExplanation} />
          </div>
        )}
      </DndContext>
    </div>
  );
};
