import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Icon } from "~/components/Icon";
import { SortableList } from "~/components/SortableList";
import { Button } from "~/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useLeaveModal } from "~/context/LeaveModalContext";
import DeleteConfirmationModal from "~/modules/Admin/components/DeleteConfirmationModal";
import LeaveConfirmationModal from "~/modules/Admin/components/LeaveConfirmationModal";
import { QuestionType } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm/QuizLessonForm.types";

import { ContentTypes, DeleteContentType } from "../../../EditCourse.types";
import Breadcrumb from "../components/Breadcrumb";

import AnswerSelectQuestion from "./components/AnswerSelectQuestion";
import FillInTheBlanksQuestion from "./components/FillInTheBlanksQuestion";
import MatchWordsQuestion from "./components/MatchWordsQuestion";
import PhotoQuestion from "./components/PhotoQuestion";
import QuestionSelector from "./components/QuestionSelector";
import QuestionWrapper from "./components/QuestionWrapper";
import QuizSettingsSection from "./components/QuizSettingsSection";
import ScaleQuestion from "./components/ScaleQuestion";
import TrueOrFalseQuestion from "./components/TrueOrFalseQuestion";
import { useQuizLessonForm } from "./hooks/useQuizLessonForm";

import type { Question, QuestionOption } from "./QuizLessonForm.types";
import type { QuizLessonFormValues } from "./validators/quizLessonFormSchema";
import type { Chapter, Lesson } from "../../../EditCourse.types";
import type { UseFormReturn } from "react-hook-form";

type QuizLessonProps = {
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
  chapterToEdit: Chapter | null;
  lessonToEdit: Lesson | null;
  setSelectedLesson: (lesson: Lesson | null) => void;
};

const QuizLessonForm = ({
  setContentTypeToDisplay,
  chapterToEdit,
  lessonToEdit,
  setSelectedLesson,
}: QuizLessonProps) => {
  const [isAttemptsLimitEnabled, setIsAttemptsLimitEnabled] = useState(
    lessonToEdit ? lessonToEdit.attemptsLimit !== null : false,
  );

  const { form, onSubmit, onDelete } = useQuizLessonForm({
    setContentTypeToDisplay,
    chapterToEdit,
    lessonToEdit,
    isAttemptsLimitEnabled,
  });
  const { t } = useTranslation();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [openQuestionIndexes, setOpenQuestionIndexes] = useState<Set<string>>(new Set());
  const {
    isLeaveModalOpen,
    closeLeaveModal,
    setIsCurrectFormDirty,
    isCurrentFormDirty,
    openLeaveModal,
    setIsLeavingContent,
  } = useLeaveModal();
  const [isCanceling, setIsCanceling] = useState(false);

  const [isValidated, setIsValidated] = useState(false);

  const questions = form.watch("questions");
  const { isDirty } = form.formState;

  const handleValidationSuccess = () => {
    setIsValidated(true);
  };

  const handleValidationError = () => {
    setIsValidated(false);
    closeLeaveModal();
  };

  const onValidate = () => {
    form.handleSubmit(handleValidationSuccess, handleValidationError)();
  };

  const onCloseModal = () => {
    setIsDeleteModalOpen(false);
  };

  const onClickDelete = () => {
    setIsDeleteModalOpen(true);
  };

  useEffect(() => {
    setIsCurrectFormDirty(isDirty);
  }, [isDirty, setIsCurrectFormDirty]);

  const onCancelModal = () => {
    closeLeaveModal();
    setIsCurrectFormDirty(false);
  };

  const onSaveModal = () => {
    form.handleSubmit(onSubmit)();
    closeLeaveModal();
  };

  const onCancel = useCallback(() => {
    if (isCurrentFormDirty) {
      setIsCanceling(true);
      setIsLeavingContent(true);
      openLeaveModal();
      return;
    }
    setContentTypeToDisplay(ContentTypes.EMPTY);
  }, [
    isCurrentFormDirty,
    setIsCanceling,
    setIsLeavingContent,
    openLeaveModal,
    setContentTypeToDisplay,
  ]);

  useEffect(() => {
    if (!isCurrentFormDirty && isCanceling) {
      onCancel();
      setIsCanceling(false);
      setIsLeavingContent(false);
    }
  }, [isCurrentFormDirty, isCanceling, onCancel, setIsLeavingContent]);

  useEffect(() => {
    const handleSubmit = () => {
      form.handleSubmit(() => setIsValidated(true))();
    };

    if (isLeaveModalOpen) {
      handleSubmit();
    }
  }, [isLeaveModalOpen, form]);

  const addQuestion = useCallback(
    (questionType: QuestionType) => {
      const questions = form.getValues("questions") || [];

      const getOptionsForQuestionType = (type: QuestionType): QuestionOption[] => {
        const singleChoiceTypes = [
          QuestionType.SINGLE_CHOICE,
          QuestionType.MULTIPLE_CHOICE,
          QuestionType.MATCH_WORDS,
          QuestionType.PHOTO_QUESTION_SINGLE_CHOICE,
          QuestionType.PHOTO_QUESTION_MULTIPLE_CHOICE,
        ];

        const noOptionsRequiredTypes = [
          QuestionType.FILL_IN_THE_BLANKS_TEXT,
          QuestionType.FILL_IN_THE_BLANKS_DND,
          QuestionType.BRIEF_RESPONSE,
          QuestionType.DETAILED_RESPONSE,
        ];

        if (type === QuestionType.MATCH_WORDS) {
          return [
            { sortableId: crypto.randomUUID(), optionText: "", isCorrect: true, displayOrder: 1 },
            { sortableId: crypto.randomUUID(), optionText: "", isCorrect: true, displayOrder: 2 },
          ];
        }

        if (type === QuestionType.SCALE_1_5) {
          return [1, 2, 3, 4, 5].map((scaleValue) => ({
            sortableId: crypto.randomUUID(),
            optionText: "",
            isCorrect: false,
            displayOrder: scaleValue,
            scaleAnswer: scaleValue,
          }));
        }

        if (singleChoiceTypes.includes(type)) {
          return [
            { sortableId: crypto.randomUUID(), optionText: "", isCorrect: false, displayOrder: 1 },
            { sortableId: crypto.randomUUID(), optionText: "", isCorrect: false, displayOrder: 2 },
          ];
        }

        if (!noOptionsRequiredTypes.includes(type)) {
          return [
            { sortableId: crypto.randomUUID(), optionText: "", isCorrect: false, displayOrder: 1 },
          ];
        }

        return [];
      };

      const options = getOptionsForQuestionType(questionType);

      const newQuestion: Question = {
        sortableId: crypto.randomUUID(),
        title: "",
        type: questionType as QuestionType,
        displayOrder: questions.length + 1,
        options: options,
      };

      form.setValue("questions", [...questions, newQuestion], { shouldDirty: true });

      setOpenQuestionIndexes((prev) => new Set(prev).add(newQuestion.sortableId));
    },
    [form],
  );

  const handleToggleQuestion = (sortableId: string) => {
    setOpenQuestionIndexes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sortableId)) {
        newSet.delete(sortableId);
      } else {
        newSet.add(sortableId);
      }
      return newSet;
    });
  };
  const renderQuestion = useCallback(
    (
      question: Question,
      questionIndex: number,
      form: UseFormReturn<QuizLessonFormValues>,
      dragTrigger: React.ReactNode,
    ) => {
      return (
        <QuestionWrapper
          key={questionIndex}
          questionType={question.type}
          questionIndex={questionIndex}
          form={form}
          dragTrigger={dragTrigger}
          item={question}
          isOpen={openQuestionIndexes.has(question.sortableId)}
          handleToggle={() => handleToggleQuestion(question.sortableId)}
        >
          {match(question.type)
            .with(QuestionType.SINGLE_CHOICE, QuestionType.MULTIPLE_CHOICE, () => (
              <AnswerSelectQuestion questionIndex={questionIndex} form={form} />
            ))
            .with(QuestionType.TRUE_OR_FALSE, () => (
              <TrueOrFalseQuestion questionIndex={questionIndex} form={form} />
            ))
            .with(
              QuestionType.PHOTO_QUESTION_SINGLE_CHOICE,
              QuestionType.PHOTO_QUESTION_MULTIPLE_CHOICE,
              () => (
                <PhotoQuestion
                  questionIndex={questionIndex}
                  form={form}
                  lessonToEdit={lessonToEdit}
                />
              ),
            )
            .with(QuestionType.MATCH_WORDS, () => (
              <MatchWordsQuestion questionIndex={questionIndex} form={form} />
            ))
            .with(QuestionType.FILL_IN_THE_BLANKS_TEXT, QuestionType.FILL_IN_THE_BLANKS_DND, () => (
              <FillInTheBlanksQuestion questionIndex={questionIndex} form={form} />
            ))
            .with(QuestionType.SCALE_1_5, () => <ScaleQuestion questionIndex={questionIndex} />)
            .otherwise(() => null)}
        </QuestionWrapper>
      );
    },
    [lessonToEdit, openQuestionIndexes],
  );

  useEffect(() => {
    setIsAttemptsLimitEnabled(lessonToEdit ? lessonToEdit.attemptsLimit !== null : false);
  }, [lessonToEdit]);

  const onSwitchChange = (checked: boolean) => {
    setIsAttemptsLimitEnabled(checked);

    if (!checked) {
      form.setValue("attemptsLimit", null);
      form.setValue("quizCooldownInHours", null);
    }
  };

  return (
    <div className="w-full max-w-full">
      <div className="w-full max-w-full rounded-lg bg-white p-8 shadow-lg">
        {!lessonToEdit && (
          <Breadcrumb
            lessonLabel="Quiz"
            setContentTypeToDisplay={setContentTypeToDisplay}
            setSelectedLesson={setSelectedLesson}
          />
        )}
        <div className="h5 mb-6 text-neutral-950">
          {lessonToEdit ? (
            <>
              <span className="text-neutral-600">
                {t("adminCourseView.curriculum.other.edit")}{" "}
              </span>
              <span className="font-bold">{lessonToEdit.title}</span>
            </>
          ) : (
            t("adminCourseView.curriculum.other.create")
          )}
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor="title" className="body-base-md">
                    <span className="mr-1 text-red-500">*</span>
                    {t("adminCourseView.curriculum.lesson.field.title")}
                  </Label>
                  <FormControl>
                    <Input id="title" {...field} required />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <QuizSettingsSection
              form={form}
              lessonToEdit={lessonToEdit}
              questionsCount={questions?.length || 0}
              isAttemptsLimitEnabled={isAttemptsLimitEnabled}
              onSwitchChange={onSwitchChange}
            />

            <div className="mt-5">
              <Label className="body-base-md">
                <span className="body-base-md mr-1 text-red-500">*</span>{" "}
                {t("adminCourseView.curriculum.lesson.field.questions")}
                <span className="text-neutral-600"> ({questions?.length || 0})</span>
              </Label>
            </div>

            {questions && questions.length > 0 && (
              <SortableList
                items={questions}
                onChange={(updatedItems) => {
                  form.setValue(`questions`, updatedItems, { shouldDirty: true });
                }}
                className="grid grid-cols-1"
                renderItem={(item, index: number) => {
                  return (
                    <SortableList.Item id={item.sortableId}>
                      {renderQuestion(
                        item,
                        index,
                        form,
                        <SortableList.DragHandle>
                          <Icon name="DragAndDropIcon" className="cursor-move" />
                        </SortableList.DragHandle>,
                      )}
                    </SortableList.Item>
                  );
                }}
              />
            )}

            <QuestionSelector addQuestion={addQuestion} />
            <div className="mt-4 flex space-x-4">
              <Button type="submit" className="bg-primary-700">
                {t("common.button.save")}
              </Button>
              {lessonToEdit ? (
                <Button
                  type="button"
                  onClick={onClickDelete}
                  className="bg-color-white border border-neutral-300 text-error-700"
                >
                  {t("common.button.delete")}
                </Button>
              ) : (
                <Button
                  className="bg-color-white border border-neutral-300 text-error-700"
                  type="button"
                  onClick={onCancel}
                >
                  {t("common.button.cancel")}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </div>
      <DeleteConfirmationModal
        open={isDeleteModalOpen}
        onClose={onCloseModal}
        onDelete={onDelete}
        contentType={DeleteContentType.QUIZ}
      />
      <LeaveConfirmationModal
        open={isLeaveModalOpen || false}
        onClose={onCancelModal}
        onSave={onSaveModal}
        onValidate={onValidate}
        isValidated={isValidated}
      />
    </div>
  );
};

export default QuizLessonForm;
