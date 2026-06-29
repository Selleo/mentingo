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
import { type FC, useEffect, useMemo, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import Viewer from "~/components/RichText/Viever";
import { useQuizContext } from "~/modules/Courses/components/QuizContextProvider";
import { getBlankAnswerIds, getBlankCount } from "~/utils/blankAnswerMarkers";

import { getCorrectSentence } from "../correctSentence";

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

const WORD_BANK_BLANK_ID = "blank_preset";
const DND_BLANK_ID_PREFIX = "blank:";

const createDndBlankId = (answerId: string) => `${DND_BLANK_ID_PREFIX}${answerId}`;

const getAnswerIdFromDndBlankId = (blankId: string) =>
  blankId.startsWith(DND_BLANK_ID_PREFIX) ? blankId.slice(DND_BLANK_ID_PREFIX.length) : blankId;

export const getAnswers = (
  options: QuizQuestionOption[] | undefined,
  blankAnswerIds: string[] = [],
  isCompleted?: boolean,
) => {
  if (!options?.length) return [];

  return options.map(
    ({ id, optionText, displayOrder, isStudentAnswer, isCorrect, studentAnswer }) => {
      const blankId = match({
        displayOrder,
        hasAnswerMarker: Boolean(id && blankAnswerIds.includes(id)),
        hasAnswerMarkers: blankAnswerIds.length > 0,
        isCompleted,
      })
        .with({ isCompleted: true, hasAnswerMarker: true }, () => createDndBlankId(id))
        .with({ isCompleted: true, hasAnswerMarkers: true }, () => WORD_BANK_BLANK_ID)
        .when(
          ({ displayOrder, isCompleted }) =>
            isCompleted && typeof displayOrder === "number" && displayOrder > 0,
          ({ displayOrder }) => `${displayOrder}`,
        )
        .otherwise(() => WORD_BANK_BLANK_ID);

      return {
        id,
        index: displayOrder ?? null,
        value: optionText,
        blankId,
        isCorrect: isCorrect,
        isStudentAnswer,
        studentAnswerText: studentAnswer,
      };
    },
  );
};

export const getCompletedAnswers = (
  options: QuizQuestionOption[] | undefined,
  blankAnswerIds: string[] = [],
  maxAnswersAmount = 0,
) => {
  if (!options?.length) return [];

  const blankOptions =
    blankAnswerIds.length > 0
      ? blankAnswerIds
          .map((answerId) => options.find((option) => option.id === answerId))
          .filter((option): option is QuizQuestionOption => Boolean(option))
      : options
          .filter((option) => Boolean(option.isCorrect))
          .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
          .slice(0, maxAnswersAmount);

  const blankOptionIds = new Set(blankOptions.map(({ id }) => id));

  const blankWords = blankOptions.map(
    ({ id, optionText, displayOrder, isStudentAnswer, isCorrect, studentAnswer }, index) => {
      const blankId = id ? createDndBlankId(id) : `${index + 1}`;

      return {
        id: `${id ?? index + 1}:submitted`,
        index: displayOrder ?? index + 1,
        value: studentAnswer ?? optionText,
        blankId,
        isCorrect,
        isStudentAnswer,
        studentAnswerText: null,
      };
    },
  );

  const wordBankWords = options
    .filter((option) => !blankOptionIds.has(option.id))
    .map(({ id, optionText, displayOrder, isStudentAnswer, isCorrect }) => ({
      id: id ?? `word-bank-${displayOrder ?? optionText}`,
      index: displayOrder ?? null,
      value: optionText,
      blankId: WORD_BANK_BLANK_ID,
      isCorrect,
      isStudentAnswer,
      studentAnswerText: null,
    }));

  return [...blankWords, ...wordBankWords];
};

const getLongestAnswerLength = (options: QuizQuestionOption[] | undefined) => {
  if (!options?.length) return 0;

  return options.reduce((maxLength, { optionText }) => {
    const answerLength = optionText?.trim().length ?? 0;
    return answerLength > maxLength ? answerLength : maxLength;
  }, 0);
};

export const FillInTheBlanksDnd: FC<FillInTheBlanksDndProps> = ({ question, isCompleted }) => {
  const { t } = useTranslation();

  const { isQuizFeedbackRedacted } = useQuizContext();
  const { setValue } = useFormContext<QuizForm>();
  const blankAnswerIds = useMemo(
    () => getBlankAnswerIds(question.description),
    [question.description],
  );

  const [words, setWords] = useState<DndWord[]>(
    getAnswers(question.options, blankAnswerIds, isCompleted),
  );
  const [currentlyDraggedWord, setCurrentlyDraggedWord] = useState<DndWord | null>(null);
  const [previewBlankId, setPreviewBlankId] = useState<string | null>(null);
  const wordsBeforeDragRef = useRef<DndWord[] | null>(null);

  const correctSentence = getCorrectSentence(question);
  const showCorrectSentence =
    Boolean(isCompleted) &&
    Boolean(correctSentence) &&
    !question.passQuestion &&
    !isQuizFeedbackRedacted;
  const blankMinWidth = useMemo(() => {
    const longestAnswerLength = getLongestAnswerLength(question.options);
    const minLength = Math.max(longestAnswerLength, 8);

    return `${minLength + 2}ch`;
  }, [question.options]);

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
    setWords(getAnswers(question.options, blankAnswerIds, isCompleted));
  }, [blankAnswerIds, isCompleted, question.options]);

  if (!question.description) return null;

  const maxAnswersAmount = getBlankCount(question.description);
  const getBlankIndex = (blankId: string) => {
    const answerId = getAnswerIdFromDndBlankId(blankId);
    const answerIdIndex = blankAnswerIds.indexOf(answerId);

    if (answerIdIndex !== -1) return answerIdIndex + 1;

    return parseInt(answerId.match(/\d+$/)?.[0] ?? "0", 10);
  };

  const isValidBlankId = (id: string) => {
    if (id === WORD_BANK_BLANK_ID) return true;
    if (id.startsWith(DND_BLANK_ID_PREFIX)) {
      return blankAnswerIds.includes(getAnswerIdFromDndBlankId(id));
    }
    if (!/^\d+$/.test(id)) return false;

    const value = Number(id);
    return value >= 1 && value <= maxAnswersAmount;
  };

  const resolveOverBlankId = (over: DragEndEvent["over"] | DragOverEvent["over"]) => {
    if (!over) return null;

    const droppableBlankId = over.data.current?.blankId;
    const sortableContainerId = over?.data?.current?.sortable?.containerId;
    const candidateId = droppableBlankId ?? sortableContainerId ?? over.id;
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
    if (occupiedTargetWord && previewBlankId !== WORD_BANK_BLANK_ID) {
      occupiedTargetWord.blankId = previewActiveWord.blankId;
    }

    previewActiveWord.blankId = previewBlankId;
    return previewWords;
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (isCompleted || !currentlyDraggedWord) return;

    const overBlankId = resolveOverBlankId(event.over);

    if (!overBlankId) {
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
        if (occupiedTargetWord && overBlankId !== WORD_BANK_BLANK_ID) {
          occupiedTargetWord.blankId = activeBlankId;
        }

        updatedActiveWord.blankId = overBlankId;
      }

      if (activeBlankId === overBlankId && overBlankId === WORD_BANK_BLANK_ID) {
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
        .filter(({ blankId }) => blankId !== WORD_BANK_BLANK_ID)
        .map((item) => {
          return {
            ...item,
            index: getBlankIndex(item.blankId),
          };
        });

      if (filteredWords.length >= 1 && filteredWords.length <= maxAnswersAmount) {
        const sortedWords = filteredWords.sort((a, b) => a.index - b.index);
        if (sortedWords.length > 0 && sortedWords.length <= maxAnswersAmount) {
          handleCompletion();
        }
      }

      const blankIds =
        blankAnswerIds.length > 0
          ? blankAnswerIds
          : Array.from({ length: maxAnswersAmount }, (_item, index) => `${index + 1}`);

      for (const blankId of blankIds) {
        setValue(`fillInTheBlanksDnd.${question.id}.${blankId}`, null);
      }

      for (const word of updatedWords) {
        if (word.blankId !== WORD_BANK_BLANK_ID) {
          const answerId = getAnswerIdFromDndBlankId(word.blankId);
          setValue(`fillInTheBlanksDnd.${question.id}.${answerId}`, word.value);
        }
      }

      return updatedWords;
    });

    resetDragState();
  }

  const wordsForRender = isCompleted
    ? getCompletedAnswers(question.options, blankAnswerIds, maxAnswersAmount)
    : words;
  const renderedWords = buildPreviewWords(wordsForRender);

  const renderedWordBankWords = renderedWords.filter(
    ({ blankId }) => blankId === WORD_BANK_BLANK_ID,
  );

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
        <DragOverlay dropAnimation={null}>
          {currentlyDraggedWord && <DraggableWord word={currentlyDraggedWord} isOverlay />}
        </DragOverlay>
        <SentenceBuilder
          content={question.description}
          replacement={(index, answerId) => {
            const blankId = answerId ? createDndBlankId(answerId) : `${index + 1}`;
            const wordsInBlank = renderedWords.filter((word) => word.blankId === blankId);

            return (
              <DndBlank
                blankId={blankId}
                words={wordsInBlank}
                isCorrect={wordsInBlank[0]?.isCorrect}
                isStudentAnswer={!!wordsInBlank[0]?.isStudentAnswer}
                minWidth={blankMinWidth}
              />
            );
          }}
        />
        <WordBank words={renderedWordBankWords} />
        {showCorrectSentence && (
          <div className="mt-4">
            <span className="body-base-md text-error-700">
              {t("studentLessonView.other.correctSentence")}
            </span>
            <Viewer content={correctSentence ?? ""} />
          </div>
        )}
      </DndContext>
    </div>
  );
};
