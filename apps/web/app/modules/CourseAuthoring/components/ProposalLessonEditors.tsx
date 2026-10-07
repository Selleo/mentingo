/** Provides native editors for the supported quiz and AI Mentor operation payloads. */
import { AI_MENTOR_TYPE } from "@repo/shared";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ContentEditor } from "~/components/RichText/Editor";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { AiJudgeConfigurationCard } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm/AiJudge/AiJudgeConfigurationCard";
import { AiMentorConfigurationCard } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm/AiMentorConfiguration/AiMentorConfigurationCard";

import type { SupportedLanguages } from "@repo/shared";
import type { AiJudgeConfigurationDraft } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm/AiJudge/aiJudgeConfiguration.types";
import type { AiMentorConfigurationDraft } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm/AiMentorConfiguration/aiMentorConfiguration.types";

type PayloadEditorProps = {
  payload: Record<string, unknown>;
  language: SupportedLanguages;
  baseLanguage?: SupportedLanguages;
  onChange: (payload: Record<string, unknown>) => void;
};

/** Narrows unknown quiz or Mentor payload values for controlled editors. */
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Normalizes an unknown list to editable record payloads. */
const asObjects = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isObject) : [];

/** Reads a bounded numeric editor value with a stable fallback. */
const numericValue = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export const CANONICAL_QUESTION_TYPES = [
  "single_choice",
  "multiple_choice",
  "true_or_false",
  "photo_question_single_choice",
  "photo_question_multiple_choice",
  "fill_in_the_blanks_text",
  "fill_in_the_blanks_dnd",
  "brief_response",
  "detailed_response",
  "scale_1_5",
] as const;

type CanonicalQuestionType = (typeof CANONICAL_QUESTION_TYPES)[number];

const questionTypeTranslationKeys: Record<CanonicalQuestionType, string> = {
  single_choice: "adminCourseView.curriculum.lesson.other.singleChoice",
  multiple_choice: "adminCourseView.curriculum.lesson.other.multipleChoice",
  true_or_false: "adminCourseView.curriculum.lesson.other.trueOrFalse",
  photo_question_single_choice: "courseAuthoring.editors.photoSingleChoice",
  photo_question_multiple_choice: "courseAuthoring.editors.photoMultipleChoice",
  fill_in_the_blanks_text: "adminCourseView.curriculum.lesson.other.fillInTheBlanksText",
  fill_in_the_blanks_dnd: "adminCourseView.curriculum.lesson.other.fillInTheBlanks",
  brief_response: "adminCourseView.curriculum.lesson.other.briefResponse",
  detailed_response: "adminCourseView.curriculum.lesson.other.detailedResponse",
  scale_1_5: "adminCourseView.curriculum.lesson.other.scale_1_5",
};

const translateQuestionType = (t: (key: string) => string, value: string) =>
  t(
    questionTypeTranslationKeys[value as CanonicalQuestionType] ??
      "courseAuthoring.review.question",
  );

/** Creates a canonical quiz answer option with the requested display order. */
const newOption = (displayOrder: number) => ({
  id: crypto.randomUUID(),
  displayOrder,
  isCorrect: displayOrder === 0,
  label: "",
});

/** Creates the full native question shape shared by all supported quiz types. */
export const createCanonicalQuestion = (
  questionType: CanonicalQuestionType,
  displayOrder: number,
) => {
  const isChoice = [
    "single_choice",
    "multiple_choice",
    "photo_question_single_choice",
    "photo_question_multiple_choice",
  ].includes(questionType);
  const isOpen = questionType === "brief_response" || questionType === "detailed_response";
  const isBlank =
    questionType === "fill_in_the_blanks_text" || questionType === "fill_in_the_blanks_dnd";
  const blankId = crypto.randomUUID();
  return {
    id: crypto.randomUUID(),
    questionType,
    displayOrder,
    maximumPoints: "1",
    gradingMode: isOpen ? "manual" : "automatic",
    prompt: "",
    title: "",
    description: null,
    photoS3Key: null,
    options: isChoice ? [newOption(0), newOption(1)] : [],
    trueFalseStatements:
      questionType === "true_or_false"
        ? [{ id: crypto.randomUUID(), displayOrder: 0, correctValue: true, statement: "" }]
        : [],
    scaleOptions:
      questionType === "scale_1_5"
        ? Array.from({ length: 5 }, (_, index) => ({
            id: crypto.randomUUID(),
            displayOrder: index,
            scaleValue: index + 1,
            label: "",
          }))
        : [],
    openTextSettings: isOpen
      ? { minimumCharacters: null, maximumCharacters: null, reviewerInstructions: null }
      : null,
    blanks: isBlank
      ? [
          {
            id: blankId,
            textComparisonMode: "normalized",
            answerSets: [{ preferredAnswer: "", acceptedAnswers: [] }],
          },
        ]
      : [],
    dragAndDropOptions:
      questionType === "fill_in_the_blanks_dnd"
        ? [{ id: crypto.randomUUID(), label: "", targetBlankId: blankId, displayOrder: 0 }]
        : [],
  };
};

/** Reindexes quiz options after an insertion or deletion. */
const withDisplayOrder = (items: Record<string, unknown>[]) =>
  items.map((item, displayOrder) => ({ ...item, displayOrder }));

/** Renders a labeled controlled text input used by lesson editors. */
const TextField = ({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: unknown;
  onChange: (value: string | number) => void;
  type?: "text" | "number";
}) => (
  <div>
    <Label>{label}</Label>
    <Input
      className="mt-1"
      type={type}
      value={typeof value === "string" || typeof value === "number" ? value : ""}
      onChange={(event) =>
        onChange(
          type === "number" && event.target.value !== ""
            ? Number(event.target.value)
            : event.target.value,
        )
      }
    />
  </div>
);

/** Edits the native ten-type quiz schema without exposing generic JSON. */
export const ProposalQuizEditor = ({ payload, onChange }: PayloadEditorProps) => {
  const { t } = useTranslation();
  const questions = asObjects(payload.questions);
  const [questionTypeToAdd, setQuestionTypeToAdd] =
    useState<CanonicalQuestionType>("single_choice");
  /** Replaces quiz questions and reindexes them for the native payload. */
  const replaceQuestions = (next: Record<string, unknown>[]) =>
    onChange({ ...payload, questions: withDisplayOrder(next) });
  /** Updates one question without changing the surrounding quiz structure. */
  const updateQuestion = (index: number, next: Record<string, unknown>) =>
    replaceQuestions(
      questions.map((question, questionIndex) => (questionIndex === index ? next : question)),
    );
  /** Moves a question while preserving the canonical display order. */
  const moveQuestion = (index: number, offset: -1 | 1) => {
    const destination = index + offset;
    if (destination < 0 || destination >= questions.length) return;
    const next = [...questions];
    [next[index], next[destination]] = [next[destination], next[index]];
    replaceQuestions(next);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label={t("courseAuthoring.editors.lessonTitle")}
          value={payload.title}
          onChange={(title) => onChange({ ...payload, title })}
        />
        <div>
          <Label>{t("courseAuthoring.editors.lessonDescription")}</Label>
          <ContentEditor
            content={typeof payload.description === "string" ? payload.description : ""}
            ariaLabel={t("courseAuthoring.editors.quizLessonDescription")}
            parentClassName="mt-1 bg-white"
            contentClassName="min-h-20"
            onChange={(description) => onChange({ ...payload, description })}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField
          label={t("courseAuthoring.editors.passScore")}
          type="number"
          value={payload.thresholdScore}
          onChange={(thresholdScore) => onChange({ ...payload, thresholdScore })}
        />
        <TextField
          label={t("courseAuthoring.editors.attemptLimit")}
          type="number"
          value={payload.attemptsLimit ?? ""}
          onChange={(attemptsLimit) =>
            onChange({ ...payload, attemptsLimit: attemptsLimit === "" ? null : attemptsLimit })
          }
        />
        <TextField
          label={t("courseAuthoring.editors.cooldownHours")}
          type="number"
          value={payload.quizCooldownInHours ?? ""}
          onChange={(quizCooldownInHours) =>
            onChange({
              ...payload,
              quizCooldownInHours: quizCooldownInHours === "" ? null : quizCooldownInHours,
            })
          }
        />
      </div>
      <div className="flex items-end gap-2 rounded-lg border border-dashed border-neutral-300 p-3">
        <div className="min-w-0 flex-1">
          <Label>{t("courseAuthoring.editors.addCanonicalQuestion")}</Label>
          <Select
            value={questionTypeToAdd}
            onValueChange={(value: CanonicalQuestionType) => setQuestionTypeToAdd(value)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CANONICAL_QUESTION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(questionTypeTranslationKeys[type])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-1.5"
          onClick={() =>
            replaceQuestions([
              ...questions,
              createCanonicalQuestion(questionTypeToAdd, questions.length),
            ])
          }
        >
          <Plus className="size-4" /> {t("courseAuthoring.editors.addQuestion")}
        </Button>
      </div>
      {questions.map((question, questionIndex) => {
        const questionType =
          typeof question.questionType === "string" ? question.questionType : "question";
        /** Merges one question field into the controlled draft payload. */
        const update = (patch: Record<string, unknown>) =>
          updateQuestion(questionIndex, { ...question, ...patch });
        const options = asObjects(question.options);
        const statements = asObjects(question.trueFalseStatements);
        const scaleOptions = asObjects(question.scaleOptions);
        const blanks = asObjects(question.blanks);
        const dragOptions = asObjects(question.dragAndDropOptions);
        const openTextSettings = isObject(question.openTextSettings)
          ? question.openTextSettings
          : null;
        const isSingleChoice =
          questionType === "single_choice" || questionType === "photo_question_single_choice";
        /** Adds an empty answer blank and its drag target when required. */
        const addBlank = () => {
          const blank = {
            id: crypto.randomUUID(),
            textComparisonMode: "normalized",
            answerSets: [{ preferredAnswer: "", acceptedAnswers: [] }],
          };
          const nextPayload: Record<string, unknown> = { blanks: [...blanks, blank] };
          if (questionType === "fill_in_the_blanks_dnd") {
            nextPayload.dragAndDropOptions = [
              ...dragOptions,
              {
                id: crypto.randomUUID(),
                label: "",
                targetBlankId: blank.id,
                displayOrder: dragOptions.length,
              },
            ];
          }
          update(nextPayload);
        };
        /** Removes an answer blank and clears drag options that pointed to it. */
        const removeBlank = (blankIndex: number) => {
          const removedBlankId = blanks[blankIndex]?.id;
          update({
            blanks: blanks.filter((_, index) => index !== blankIndex),
            ...(questionType === "fill_in_the_blanks_dnd" && typeof removedBlankId === "string"
              ? {
                  dragAndDropOptions: dragOptions.map((option) =>
                    option.targetBlankId === removedBlankId
                      ? { ...option, targetBlankId: null }
                      : option,
                  ),
                }
              : {}),
          });
        };

        return (
          <section
            key={typeof question.id === "string" ? question.id : questionIndex}
            className="rounded-lg border border-neutral-200 bg-neutral-50 p-3"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">
                {t("courseAuthoring.editors.questionNumber", { number: questionIndex + 1 })}
              </span>
              <div className="flex items-center gap-1">
                <span className="rounded bg-white px-2 py-1 text-[10px] font-medium uppercase text-neutral-600">
                  {translateQuestionType(t, questionType)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={questionIndex === 0}
                  aria-label={t("courseAuthoring.editors.moveQuestionUp")}
                  onClick={() => moveQuestion(questionIndex, -1)}
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={questionIndex === questions.length - 1}
                  aria-label={t("courseAuthoring.editors.moveQuestionDown")}
                  onClick={() => moveQuestion(questionIndex, 1)}
                >
                  <ArrowDown className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("courseAuthoring.editors.removeQuestion")}
                  onClick={() =>
                    replaceQuestions(questions.filter((_, index) => index !== questionIndex))
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_120px_160px]">
              <TextField
                label={t("courseAuthoring.editors.title")}
                value={question.title}
                onChange={(title) => update({ title })}
              />
              <TextField
                label={t("courseAuthoring.editors.points")}
                value={question.maximumPoints}
                onChange={(maximumPoints) => update({ maximumPoints: String(maximumPoints) })}
              />
              <div>
                <Label>{t("courseAuthoring.editors.grading")}</Label>
                <Select
                  value={
                    typeof question.gradingMode === "string" ? question.gradingMode : "automatic"
                  }
                  onValueChange={(gradingMode) => update({ gradingMode })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automatic">
                      {t("courseAuthoring.editors.automatic")}
                    </SelectItem>
                    <SelectItem value="manual">{t("courseAuthoring.editors.manual")}</SelectItem>
                    <SelectItem value="participation">
                      {t("courseAuthoring.editors.participation")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-3">
              <Label>{t("courseAuthoring.editors.questionPrompt")}</Label>
              <ContentEditor
                content={typeof question.prompt === "string" ? question.prompt : ""}
                ariaLabel={t("courseAuthoring.editors.questionPromptAria", {
                  number: questionIndex + 1,
                })}
                parentClassName="mt-1 bg-white"
                contentClassName="min-h-28"
                onChange={(prompt) => update({ prompt })}
              />
            </div>
            <div className="mt-3">
              <Label>{t("courseAuthoring.editors.explanationOrReviewerContext")}</Label>
              <ContentEditor
                content={typeof question.description === "string" ? question.description : ""}
                ariaLabel={t("courseAuthoring.editors.questionDescriptionAria", {
                  number: questionIndex + 1,
                })}
                parentClassName="mt-1 bg-white"
                contentClassName="min-h-20"
                onChange={(description) => update({ description: description || null })}
              />
            </div>
            {typeof question.photoS3Key === "string" && (
              <p className="mt-2 rounded-md bg-white p-2 text-xs text-neutral-600">
                {t("courseAuthoring.editors.preparedQuestionImageRetained")}
              </p>
            )}

            {[
              "single_choice",
              "multiple_choice",
              "photo_question_single_choice",
              "photo_question_multiple_choice",
            ].includes(questionType) && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t("courseAuthoring.editors.answerOptions")}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    onClick={() => update({ options: [...options, newOption(options.length)] })}
                  >
                    <Plus className="size-3.5" /> {t("courseAuthoring.editors.addOption")}
                  </Button>
                </div>
                {options.map((option, optionIndex) => (
                  <div
                    key={typeof option.id === "string" ? option.id : optionIndex}
                    className="flex items-center gap-2"
                  >
                    <Checkbox
                      aria-label={t("courseAuthoring.editors.optionCorrect", {
                        number: optionIndex + 1,
                      })}
                      checked={option.isCorrect === true}
                      onCheckedChange={(isCorrect) =>
                        update({
                          options: options.map((entry, index) => {
                            if (isSingleChoice) {
                              return {
                                ...entry,
                                isCorrect: index === optionIndex && isCorrect === true,
                              };
                            }
                            if (index === optionIndex) {
                              return { ...entry, isCorrect: isCorrect === true };
                            }
                            return entry;
                          }),
                        })
                      }
                    />
                    <Input
                      value={typeof option.label === "string" ? option.label : ""}
                      aria-label={t("courseAuthoring.editors.option", { number: optionIndex + 1 })}
                      onChange={(event) =>
                        update({
                          options: options.map((entry, index) =>
                            index === optionIndex ? { ...entry, label: event.target.value } : entry,
                          ),
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={optionIndex === 0}
                      aria-label={t("courseAuthoring.editors.moveOptionUp")}
                      onClick={() => {
                        const next = [...options];
                        [next[optionIndex - 1], next[optionIndex]] = [
                          next[optionIndex],
                          next[optionIndex - 1],
                        ];
                        update({ options: withDisplayOrder(next) });
                      }}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={optionIndex === options.length - 1}
                      aria-label={t("courseAuthoring.editors.moveOptionDown")}
                      onClick={() => {
                        const next = [...options];
                        [next[optionIndex + 1], next[optionIndex]] = [
                          next[optionIndex],
                          next[optionIndex + 1],
                        ];
                        update({ options: withDisplayOrder(next) });
                      }}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("courseAuthoring.editors.removeOption")}
                      onClick={() =>
                        update({
                          options: withDisplayOrder(
                            options.filter((_, index) => index !== optionIndex),
                          ),
                        })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {questionType === "true_or_false" && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t("courseAuthoring.editors.trueFalseStatements")}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    onClick={() =>
                      update({
                        trueFalseStatements: [
                          ...statements,
                          {
                            id: crypto.randomUUID(),
                            displayOrder: statements.length,
                            correctValue: true,
                            statement: "",
                          },
                        ],
                      })
                    }
                  >
                    <Plus className="size-3.5" /> {t("courseAuthoring.editors.addStatement")}
                  </Button>
                </div>
                {statements.map((statement, statementIndex) => (
                  <div
                    key={typeof statement.id === "string" ? statement.id : statementIndex}
                    className="grid grid-cols-[1fr_110px_auto] gap-2"
                  >
                    <Input
                      value={typeof statement.statement === "string" ? statement.statement : ""}
                      onChange={(event) =>
                        update({
                          trueFalseStatements: statements.map((entry, index) =>
                            index === statementIndex
                              ? { ...entry, statement: event.target.value }
                              : entry,
                          ),
                        })
                      }
                    />
                    <Select
                      value={statement.correctValue === true ? "true" : "false"}
                      onValueChange={(value) =>
                        update({
                          trueFalseStatements: statements.map((entry, index) =>
                            index === statementIndex
                              ? { ...entry, correctValue: value === "true" }
                              : entry,
                          ),
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">{t("courseAuthoring.editors.true")}</SelectItem>
                        <SelectItem value="false">{t("courseAuthoring.editors.false")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("courseAuthoring.editors.removeStatement")}
                      onClick={() =>
                        update({
                          trueFalseStatements: withDisplayOrder(
                            statements.filter((_, index) => index !== statementIndex),
                          ),
                        })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {questionType === "scale_1_5" && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {scaleOptions.map((option, optionIndex) => (
                  <div
                    key={typeof option.id === "string" ? option.id : optionIndex}
                    className="space-y-1"
                  >
                    <TextField
                      label={t("courseAuthoring.editors.scaleValue")}
                      type="number"
                      value={numericValue(option.scaleValue, optionIndex + 1)}
                      onChange={(scaleValue) =>
                        update({
                          scaleOptions: scaleOptions.map((entry, index) =>
                            index === optionIndex ? { ...entry, scaleValue } : entry,
                          ),
                        })
                      }
                    />
                    <TextField
                      label={t("courseAuthoring.editors.label")}
                      value={option.label}
                      onChange={(label) =>
                        update({
                          scaleOptions: scaleOptions.map((entry, index) =>
                            index === optionIndex ? { ...entry, label } : entry,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            {openTextSettings && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <TextField
                  label={t("courseAuthoring.editors.minimumCharacters")}
                  type="number"
                  value={openTextSettings.minimumCharacters ?? ""}
                  onChange={(minimumCharacters) =>
                    update({
                      openTextSettings: {
                        ...openTextSettings,
                        minimumCharacters: minimumCharacters === "" ? null : minimumCharacters,
                      },
                    })
                  }
                />
                <TextField
                  label={t("courseAuthoring.editors.maximumCharacters")}
                  type="number"
                  value={openTextSettings.maximumCharacters ?? ""}
                  onChange={(maximumCharacters) =>
                    update({
                      openTextSettings: {
                        ...openTextSettings,
                        maximumCharacters: maximumCharacters === "" ? null : maximumCharacters,
                      },
                    })
                  }
                />
                <TextField
                  label={t("courseAuthoring.editors.reviewerGuidance")}
                  value={openTextSettings.reviewerInstructions}
                  onChange={(reviewerInstructions) =>
                    update({ openTextSettings: { ...openTextSettings, reviewerInstructions } })
                  }
                />
              </div>
            )}

            {(questionType === "fill_in_the_blanks_text" ||
              questionType === "fill_in_the_blanks_dnd") && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t("courseAuthoring.editors.blankAnswerSets")}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    onClick={addBlank}
                  >
                    <Plus className="size-3.5" /> {t("courseAuthoring.editors.addBlank")}
                  </Button>
                </div>
                {blanks.map((blank, blankIndex) => {
                  const answerSets = asObjects(blank.answerSets);
                  return (
                    <div
                      key={typeof blank.id === "string" ? blank.id : blankIndex}
                      className="space-y-2 rounded-md bg-white p-2"
                    >
                      <div className="flex items-center gap-2">
                        <Select
                          value={blank.textComparisonMode === "exact" ? "exact" : "normalized"}
                          onValueChange={(textComparisonMode) =>
                            update({
                              blanks: blanks.map((entry, index) =>
                                index === blankIndex ? { ...entry, textComparisonMode } : entry,
                              ),
                            })
                          }
                        >
                          <SelectTrigger className="h-8 w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normalized">
                              {t("courseAuthoring.editors.normalizedMatch")}
                            </SelectItem>
                            <SelectItem value="exact">
                              {t("courseAuthoring.editors.exactMatch")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="ml-auto gap-1"
                          onClick={() =>
                            update({
                              blanks: blanks.map((entry, index) =>
                                index === blankIndex
                                  ? {
                                      ...entry,
                                      answerSets: [
                                        ...answerSets,
                                        { preferredAnswer: "", acceptedAnswers: [] },
                                      ],
                                    }
                                  : entry,
                              ),
                            })
                          }
                        >
                          <Plus className="size-3.5" /> {t("courseAuthoring.editors.answerSet")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t("courseAuthoring.editors.removeBlank")}
                          onClick={() => removeBlank(blankIndex)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                      {answerSets.map((answerSet, answerIndex) => (
                        <div
                          key={`${blankIndex}-${answerIndex}`}
                          className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
                        >
                          <Input
                            value={
                              typeof answerSet.preferredAnswer === "string"
                                ? answerSet.preferredAnswer
                                : ""
                            }
                            aria-label={t("courseAuthoring.editors.preferredAnswer")}
                            onChange={(event) =>
                              update({
                                blanks: blanks.map((blankEntry, currentBlankIndex) =>
                                  currentBlankIndex === blankIndex
                                    ? {
                                        ...blankEntry,
                                        answerSets: answerSets.map((entry, currentAnswerIndex) =>
                                          currentAnswerIndex === answerIndex
                                            ? { ...entry, preferredAnswer: event.target.value }
                                            : entry,
                                        ),
                                      }
                                    : blankEntry,
                                ),
                              })
                            }
                          />
                          <Input
                            value={
                              Array.isArray(answerSet.acceptedAnswers)
                                ? answerSet.acceptedAnswers
                                    .filter((item): item is string => typeof item === "string")
                                    .join(", ")
                                : ""
                            }
                            aria-label={t("courseAuthoring.editors.acceptedAnswers")}
                            onChange={(event) =>
                              update({
                                blanks: blanks.map((blankEntry, currentBlankIndex) =>
                                  currentBlankIndex === blankIndex
                                    ? {
                                        ...blankEntry,
                                        answerSets: answerSets.map((entry, currentAnswerIndex) =>
                                          currentAnswerIndex === answerIndex
                                            ? {
                                                ...entry,
                                                acceptedAnswers: event.target.value
                                                  .split(",")
                                                  .map((item) => item.trim())
                                                  .filter(Boolean),
                                              }
                                            : entry,
                                        ),
                                      }
                                    : blankEntry,
                                ),
                              })
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={t("courseAuthoring.editors.removeAnswerSet")}
                            onClick={() =>
                              update({
                                blanks: blanks.map((entry, index) =>
                                  index === blankIndex
                                    ? {
                                        ...entry,
                                        answerSets: answerSets.filter(
                                          (_, current) => current !== answerIndex,
                                        ),
                                      }
                                    : entry,
                                ),
                              })
                            }
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {questionType === "fill_in_the_blanks_dnd" && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t("courseAuthoring.editors.dragOptions")}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    onClick={() =>
                      update({
                        dragAndDropOptions: [
                          ...dragOptions,
                          {
                            id: crypto.randomUUID(),
                            label: "",
                            targetBlankId: typeof blanks[0]?.id === "string" ? blanks[0].id : null,
                            displayOrder: dragOptions.length,
                          },
                        ],
                      })
                    }
                  >
                    <Plus className="size-3.5" /> {t("courseAuthoring.editors.addOption")}
                  </Button>
                </div>
                {dragOptions.map((option, optionIndex) => (
                  <div
                    key={typeof option.id === "string" ? option.id : optionIndex}
                    className="grid gap-2 sm:grid-cols-[1fr_180px_auto]"
                  >
                    <Input
                      value={typeof option.label === "string" ? option.label : ""}
                      onChange={(event) =>
                        update({
                          dragAndDropOptions: dragOptions.map((entry, index) =>
                            index === optionIndex ? { ...entry, label: event.target.value } : entry,
                          ),
                        })
                      }
                    />
                    <Select
                      value={
                        typeof option.targetBlankId === "string"
                          ? option.targetBlankId
                          : "unassigned"
                      }
                      onValueChange={(targetBlankId) =>
                        update({
                          dragAndDropOptions: dragOptions.map((entry, index) =>
                            index === optionIndex
                              ? {
                                  ...entry,
                                  targetBlankId:
                                    targetBlankId === "unassigned" ? null : targetBlankId,
                                }
                              : entry,
                          ),
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">
                          {t("courseAuthoring.editors.unassigned")}
                        </SelectItem>
                        {blanks.map(
                          (blank, index) =>
                            typeof blank.id === "string" && (
                              <SelectItem key={blank.id} value={blank.id}>
                                {t("courseAuthoring.editors.blankNumber", { number: index + 1 })}
                              </SelectItem>
                            ),
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("courseAuthoring.editors.removeDragOption")}
                      onClick={() =>
                        update({
                          dragAndDropOptions: withDisplayOrder(
                            dragOptions.filter((_, index) => index !== optionIndex),
                          ),
                        })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

/** Reads an AI Mentor draft from an operation payload when its shape is valid. */
const mentorDraft = (payload: Record<string, unknown>): AiMentorConfigurationDraft | undefined => {
  const type = payload.configurationType;
  const configuration = payload.configuration;
  if (
    (type !== AI_MENTOR_TYPE.TEACHER && type !== AI_MENTOR_TYPE.ROLEPLAY) ||
    !isObject(configuration)
  )
    return undefined;
  return { ...configuration, type } as AiMentorConfigurationDraft;
};

/** Reads judge configuration draft data for the Mentor editor. */
const judgeDraft = (payload: Record<string, unknown>): AiJudgeConfigurationDraft | undefined => {
  if (!isObject(payload.judgeConfiguration)) return undefined;
  const judge = payload.judgeConfiguration;
  return {
    taskGoal: typeof judge.taskGoal === "string" ? judge.taskGoal : "",
    passingThresholdPercent: numericValue(judge.passingThresholdPercent),
    criteria: asObjects(judge.criteria).map((criterion) => ({
      title: typeof criterion.title === "string" ? criterion.title : "",
      expectedBehavior:
        typeof criterion.expectedBehavior === "string" ? criterion.expectedBehavior : "",
      maxScore: numericValue(criterion.maxScore, 1),
      scoreGuidance: asObjects(criterion.scoreGuidance).map((guidance) => ({
        score: numericValue(guidance.score),
        description: typeof guidance.description === "string" ? guidance.description : "",
        example: typeof guidance.example === "string" ? guidance.example : undefined,
      })),
    })),
    blockingErrors: asObjects(judge.blockingErrors).map((error) => ({
      description: typeof error.description === "string" ? error.description : "",
    })),
  };
};

/** Edits native Mentor configuration and judge fields with translation safeguards. */
export const ProposalMentorEditor = ({
  payload,
  language,
  baseLanguage = language,
  onChange,
}: PayloadEditorProps) => {
  const { t } = useTranslation();
  const mentor = mentorDraft(payload);
  const judge = judgeDraft(payload);
  /** Emits the edited Mentor configuration as a proposal operation payload. */
  const saveMentor = (configuration: AiMentorConfigurationDraft) => {
    const { type, ...fields } = configuration;
    onChange({ ...payload, configurationType: type, configuration: fields });
  };
  /** Emits the edited judge configuration as a proposal operation payload. */
  const saveJudge = (configuration: AiJudgeConfigurationDraft) =>
    onChange({
      ...payload,
      judgeConfiguration: {
        taskGoal: configuration.taskGoal,
        passingThresholdPercent: configuration.passingThresholdPercent,
        criteria: configuration.criteria.map((criterion, index) => ({
          ...criterion,
          ref: `C${index + 1}`,
          scoreGuidance: criterion.scoreGuidance.map((guidance) => ({
            ...guidance,
            example: guidance.example ?? null,
          })),
        })),
        blockingErrors: configuration.blockingErrors.map((error, index) => ({
          ...error,
          ref: `B${index + 1}`,
        })),
      },
    });

  return (
    <div className="mt-3 space-y-3">
      <TextField
        label={t("courseAuthoring.editors.lessonTitle")}
        value={payload.title}
        onChange={(title) => onChange({ ...payload, title })}
      />
      <TextField
        label={t("courseAuthoring.editors.mentorName")}
        value={payload.name}
        onChange={(name) => onChange({ ...payload, name })}
      />
      <div>
        <Label>{t("courseAuthoring.editors.learnerFacingDescription")}</Label>
        <ContentEditor
          content={typeof payload.description === "string" ? payload.description : ""}
          ariaLabel={t("courseAuthoring.editors.aiMentorDescription")}
          parentClassName="mt-1 bg-white"
          contentClassName="min-h-24"
          onChange={(description) => onChange({ ...payload, description })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>{t("courseAuthoring.editors.voiceMode")}</Label>
          <Select
            value={typeof payload.voiceMode === "string" ? payload.voiceMode : "none"}
            onValueChange={(voiceMode) =>
              onChange({
                ...payload,
                voiceMode: voiceMode === "none" ? null : voiceMode,
                ...(voiceMode !== "preset" ? { ttsPreset: null } : {}),
                ...(voiceMode !== "custom" ? { customTtsReference: null } : {}),
              })
            }
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("courseAuthoring.editors.noGeneratedVoice")}</SelectItem>
              <SelectItem value="preset">
                {t("adminCourseView.curriculum.lesson.other.voiceModePreset")}
              </SelectItem>
              <SelectItem value="custom">
                {t("adminCourseView.curriculum.lesson.other.voiceModeCustom")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        {payload.voiceMode === "preset" && (
          <div>
            <Label>{t("courseAuthoring.editors.voicePreset")}</Label>
            <Select
              value={payload.ttsPreset === "female" ? "female" : "male"}
              onValueChange={(ttsPreset) => onChange({ ...payload, ttsPreset })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="female">
                  {t("adminCourseView.curriculum.lesson.other.voicePresetFemale")}
                </SelectItem>
                <SelectItem value="male">
                  {t("adminCourseView.curriculum.lesson.other.voicePresetMale")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {payload.voiceMode === "custom" && (
          <TextField
            label={t("courseAuthoring.editors.customVoiceReference")}
            value={payload.customTtsReference}
            onChange={(customTtsReference) => onChange({ ...payload, customTtsReference })}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-neutral-600">
        <span className="rounded bg-neutral-100 px-2 py-1">
          {t("courseAuthoring.editors.approvedSources", {
            count: Array.isArray(payload.sourceVersionIds) ? payload.sourceVersionIds.length : 0,
          })}
        </span>
        <span className="rounded bg-neutral-100 px-2 py-1">
          {t("courseAuthoring.editors.preparedResources", {
            count: Array.isArray(payload.preparedResourceIds)
              ? payload.preparedResourceIds.length
              : 0,
          })}
        </span>
        {typeof payload.avatarAssetId === "string" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onChange({ ...payload, avatarAssetId: null })}
          >
            {t("courseAuthoring.editors.removePreparedAvatar")}
          </Button>
        )}
      </div>
      <AiMentorConfigurationCard
        value={mentor}
        onSaveBaseConfiguration={saveMentor}
        onSaveTranslation={saveMentor}
        language={language}
        baseLanguage={baseLanguage}
        isPersisted
      />
      <AiJudgeConfigurationCard
        value={judge}
        onSaveBaseConfiguration={saveJudge}
        onSaveTranslation={saveJudge}
        language={language}
        baseLanguage={baseLanguage}
        isPersisted
        isAiMentorConfigured={Boolean(mentor)}
      />
    </div>
  );
};
