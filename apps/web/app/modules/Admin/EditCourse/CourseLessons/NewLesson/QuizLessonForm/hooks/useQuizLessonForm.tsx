// TODO: Need to be fixed
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "@remix-run/react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useCreateQuizLesson } from "~/api/mutations/admin/useCreateQuizLesson";
import { useDeleteLesson } from "~/api/mutations/admin/useDeleteLesson";
import { useUpdateQuizLesson } from "~/api/mutations/admin/useUpdateQuizLesson";
import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { queryClient } from "~/api/queryClient";
import { useLeaveModal } from "~/context/LeaveModalContext";
import { ContentTypes, LessonType } from "~/modules/Admin/EditCourse/EditCourse.types";
import { StringifiedIcons } from "~/utils/stringifiedIcons";

import { FILL_IN_THE_BLANKS_BUTTON_CLASSNAME } from "../components/constants";
import { defaultQuizLessonValues } from "../defaults/defaultQuizLessonValues";
import { QuestionType } from "../QuizLessonForm.types";
import { quizLessonFormSchema } from "../validators/quizLessonFormSchema";

import type { Question, QuestionOption } from "../QuizLessonForm.types";
import type { QuizLessonFormValues } from "../validators/quizLessonFormSchema";
import type { SupportedLanguages } from "@repo/shared";
import type { Chapter, Lesson } from "~/modules/Admin/EditCourse/EditCourse.types";

type QuizLessonFormProps = {
  chapterToEdit: Chapter | null;
  lessonToEdit: Lesson | null;
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
  isAttemptsLimitEnabled: boolean;
  language: SupportedLanguages;
};

export const useQuizLessonForm = ({
  chapterToEdit,
  lessonToEdit,
  setContentTypeToDisplay,
  isAttemptsLimitEnabled,
  language,
}: QuizLessonFormProps) => {
  const { mutateAsync: createQuizLesson } = useCreateQuizLesson();
  const { mutateAsync: updateQuizLesson } = useUpdateQuizLesson();
  const { mutateAsync: deleteLesson } = useDeleteLesson();
  const { isLeavingContent, setIsCurrectFormDirty } = useLeaveModal();
  const { id: courseId } = useParams();
  const { t } = useTranslation();

  const createButtonHtml = (word: string) => {
    return `<button type="button" class="${FILL_IN_THE_BLANKS_BUTTON_CLASSNAME}" data-word="${word}"><span>${word}</span><span>${StringifiedIcons.X}</span></button>`;
  };

  const form = useForm<QuizLessonFormValues>({
    resolver: zodResolver(quizLessonFormSchema(t)),
    defaultValues: {
      title: "",
      thresholdScore: null,
      attemptsLimit: null,
      quizCooldownInHours: null,
      questions: [],
    },
  });

  const { reset } = form;

  useEffect(() => {
    if (lessonToEdit) {
      const mappedData: QuizLessonFormValues = {
        title: lessonToEdit.title,
        thresholdScore: null,
        attemptsLimit: null,
        quizCooldownInHours: null,
        questions:
          lessonToEdit.questions?.map((question: Question) => {
            let processedDescription = question.description || "";

            const wordMatches = [...processedDescription.matchAll(/\[word\]/g)];

            wordMatches.forEach((match, index) => {
              const displayOrder = index + 1;
              const option = question.options?.find((opt) => opt.displayOrder === displayOrder);

              if (option) {
                const buttonHtml = createButtonHtml(option.optionText);
                processedDescription = processedDescription.replace(match[0], buttonHtml);
              }
            });

            return {
              id: question.id,
              sortableId: question.id,
              type: question.type as QuestionType,
              description: processedDescription || undefined,
              photoS3Key: question.photoS3Key || undefined,
              title: question.title,
              displayOrder: question.displayOrder,
              options: question.options?.map((option: QuestionOption) => ({
                id: option.id,
                sortableId: option.id,
                optionText: option.optionText,
                isCorrect: option.isCorrect,
                displayOrder: option.displayOrder,
                matchedWord: option.matchedWord || undefined,
                scaleAnswer: option.scaleAnswer || undefined,
              })),
            };
          }) || [],
      };

      reset(mappedData);
    }
  }, [lessonToEdit, reset]);

  const onDelete = async () => {
    if (!chapterToEdit?.id || !lessonToEdit?.id) {
      console.error("Course ID or Chapter ID is missing.");
      return;
    }

    try {
      await deleteLesson({ chapterId: chapterToEdit?.id, lessonId: lessonToEdit.id });
      queryClient.invalidateQueries({
        queryKey: [COURSE_QUERY_KEY, { id: courseId }],
      });
      setContentTypeToDisplay(ContentTypes.EMPTY);
    } catch (error) {
      console.error("Failed to delete chapter:", error);
    }
  };

  const onSubmit = async (values: QuizLessonFormValues) => {
    if (!chapterToEdit) {
      return;
    }

    const updatedQuestions = values.questions.map((question) => {
      let updatedSolutionExplanation = question?.description;
      const buttons = updatedSolutionExplanation?.match(/<button\b[^>]*>[\s\S]*?<\/button>/g);
      if (buttons && question.options) {
        question.options.sort((a, b) => a.displayOrder - b.displayOrder);

        buttons.forEach((button, index) => {
          if (question?.options?.[index]) {
            const optionText = question?.options[index].optionText;
            updatedSolutionExplanation = updatedSolutionExplanation?.replace(
              button,
              `<strong>${optionText}</strong>`,
            );
          }
        });
      }

      values.thresholdScore =
        values.thresholdScore ??
        lessonToEdit?.thresholdScore ??
        defaultQuizLessonValues.thresholdScore;

      if (isAttemptsLimitEnabled) {
        values.attemptsLimit =
          values.attemptsLimit ??
          lessonToEdit?.attemptsLimit ??
          defaultQuizLessonValues.attemptsLimit;
        values.quizCooldownInHours =
          values.quizCooldownInHours ??
          lessonToEdit?.quizCooldownInHours ??
          defaultQuizLessonValues.quizCooldownInHours;
      }

      if (
        (question.type === QuestionType.FILL_IN_THE_BLANKS_DND ||
          question.type === QuestionType.FILL_IN_THE_BLANKS_TEXT) &&
        question.description
      ) {
        return {
          ...question,
          description: question.description.replace(/<button\b[^>]*>[\s\S]*?<\/button>/g, "[word]"),
          solutionExplanation: updatedSolutionExplanation,
        };
      }
      return question;
    });

    try {
      if (lessonToEdit) {
        await updateQuizLesson({
          data: {
            ...values,
            questions: updatedQuestions,
            type: LessonType.QUIZ,
            language,
          },
          lessonId: lessonToEdit.id,
        });
      } else {
        await createQuizLesson({
          data: {
            ...values,
            questions: updatedQuestions,
            type: LessonType.QUIZ,
            chapterId: chapterToEdit.id,
            language,
          },
        });
      }
      if (!isLeavingContent) {
        setContentTypeToDisplay(ContentTypes.EMPTY);
      }
      setIsCurrectFormDirty(false);
      queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY, { id: courseId }] });
    } catch (error) {
      console.error("Error creating text block:", error);
    }
  };

  return { form, onSubmit, onDelete };
};
