import { useParams } from "@remix-run/react";
import { AI_MENTOR_PRACTICE_STATUSES } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useRetryAiMentorPractice } from "~/api/mutations/useRetryAiMentorPractice";
import { useAiMentorPractice } from "~/api/queries/useAiMentorPractice";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import Loader from "~/modules/common/Loader/Loader";

import { AiMentorPracticeConversation } from "./AiMentorPracticeConversation";
import { AiMentorPracticeForm } from "./AiMentorPracticeForm";

export default function AiMentorPracticePage() {
  const { t } = useTranslation();
  const { id = "new" } = useParams();
  const isNew = id === "new";
  const { data: practice, isLoading, isError, refetch } = useAiMentorPractice(isNew ? "" : id);
  const { mutateAsync: retryPractice, isPending: isRetrying } = useRetryAiMentorPractice();

  if (isNew) return <AiMentorPracticeForm />;

  if (isLoading) {
    return (
      <PageWrapper className="flex min-h-80 items-center justify-center">
        <Loader />
      </PageWrapper>
    );
  }

  if (isError || !practice) {
    return (
      <PageWrapper className="flex min-h-80 flex-col items-center justify-center gap-3">
        <p>{t("aiMentorPractice.error")}</p>
        <Button variant="outline" onClick={() => void refetch()}>
          {t("dashboardHome.error.retry")}
        </Button>
      </PageWrapper>
    );
  }

  if (
    practice.status === AI_MENTOR_PRACTICE_STATUSES.QUEUED ||
    practice.status === AI_MENTOR_PRACTICE_STATUSES.PROCESSING
  ) {
    return (
      <PageWrapper className="flex min-h-80 flex-col items-center justify-center gap-4">
        <Loader />
        <p>{t("aiMentorPractice.generating")}</p>
      </PageWrapper>
    );
  }

  if (practice.status === AI_MENTOR_PRACTICE_STATUSES.FAILED) {
    return (
      <PageWrapper className="flex min-h-80 flex-col items-center justify-center gap-4">
        <p>{t("aiMentorPractice.failed")}</p>
        <Button disabled={isRetrying} onClick={() => void retryPractice(practice.id)}>
          {t("aiMentorPractice.retry")}
        </Button>
      </PageWrapper>
    );
  }

  return <AiMentorPracticeConversation threadId={practice.threadId ?? ""} title={practice.title} />;
}
