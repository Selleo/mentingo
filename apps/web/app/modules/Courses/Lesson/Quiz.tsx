import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "@remix-run/react";
import { FormProvider, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useSubmitQuiz } from "~/api/mutations";
import { queryClient } from "~/api/queryClient";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/use-toast";
import { useUserRole } from "~/hooks/useUserRole";

import { Questions } from "./Questions";
import { QuizFormSchema } from "./schemas";
import { getUserAnswers, parseQuizFormData } from "./utils";

import type { QuizForm } from "./types";
import type { GetLessonByIdResponse } from "~/api/generated-api";

type QuizProps = {
  lesson: GetLessonByIdResponse["data"];
};

export const Quiz = ({ lesson }: QuizProps) => {
  const { lessonId = "" } = useParams();
  const { t } = useTranslation();
  const { isAdminLike } = useUserRole();

  const questions = lesson.quizDetails?.questions;

  const isUserSubmitted = questions?.[0]?.options?.[0].studentAnswer !== null;
  const methods = useForm<QuizForm>({
    mode: "onSubmit",
    // Temporary workaround
    defaultValues: getUserAnswers(questions ?? []) as QuizForm,
    resolver: zodResolver(QuizFormSchema(t)),
  });

  const submitQuiz = useSubmitQuiz({
    handleOnSuccess: () => queryClient.invalidateQueries({ queryKey: ["lesson", lessonId] }),
  });

  if (!questions?.length) return null;

  const handleOnSubmit = async (data: QuizForm) => {
    submitQuiz.mutate({ lessonId, questionsAnswers: parseQuizFormData(data) });
  };

  return (
    <FormProvider {...methods}>
      <form
        className="flex w-full flex-col gap-y-4"
        onSubmit={methods.handleSubmit(handleOnSubmit, () => {
          toast({
            variant: "destructive",
            description: t("studentLessonView.validation.unansweredQuestions"),
          });
        })}
      >
        <Questions questions={questions} isQuizCompleted={lesson.lessonCompleted} />
        <Button
          type="submit"
          className="flex items-center gap-x-2 self-end"
          disabled={isAdminLike || isUserSubmitted}
        >
          <span>{t("studentLessonView.button.submit")}</span>
          <Icon name="ArrowRight" className="h-auto w-4" />
        </Button>
      </form>
    </FormProvider>
  );
};
