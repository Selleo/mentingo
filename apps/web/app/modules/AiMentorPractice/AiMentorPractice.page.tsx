import { Link, useParams } from "@remix-run/react";
import { AI_MENTOR_PRACTICE_STATUSES } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useRetryAiMentorPractice } from "~/api/mutations/useRetryAiMentorPractice";
import { useAiMentorPractice } from "~/api/queries/useAiMentorPractice";
import { Icon } from "~/components/Icon";
import { LoaderWithTextSequence } from "~/components/LoaderWithTextSequence";
import { PageWrapper } from "~/components/PageWrapper";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
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
  const breadcrumbs = [
    { title: t("navigationSideBar.dashboard"), href: "/dashboard" },
    { title: t("aiMentorPractice.conversationTitle"), href: `/ai-mentor/practice/${id}` },
  ];

  if (isNew) return <AiMentorPracticeForm />;

  if (isLoading) {
    return (
      <PageWrapper breadcrumbs={breadcrumbs} className="flex min-h-80 items-center justify-center">
        <Loader />
      </PageWrapper>
    );
  }

  if (isError || !practice) {
    return (
      <PageWrapper
        breadcrumbs={breadcrumbs}
        className="flex min-h-80 flex-col items-center justify-center gap-3"
      >
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
      <PageWrapper
        breadcrumbs={breadcrumbs}
        className="mx-auto flex min-h-[24rem] max-w-3xl flex-col"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
          <p className="details-md min-w-0 flex-1 text-neutral-700">
            {t("aiMentorPractice.preparingBackgroundDescription")}
          </p>
          <Button asChild variant="outline" size="sm" className="shrink-0 bg-white">
            <Link to="/dashboard">{t("common.button.goToDashboard")}</Link>
          </Button>
        </div>
        <h1 className="sr-only">{t("aiMentorPractice.conversationTitle")}</h1>

        <div className="mt-8 flex items-start gap-3" aria-live="polite">
          <Avatar className="size-9 shrink-0 bg-primary-100">
            <AvatarFallback>
              <Icon name="AiMentor" className="p-1 text-primary-600" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 pt-0.5">
            <p className="body-sm-md text-primary-900">{t("aiMentorPractice.mentorName")}</p>
            <LoaderWithTextSequence
              preset="aiMentor"
              showLoader={false}
              className="items-start gap-1 text-left text-neutral-700"
              textClassName="loading-text-shimmer"
            />
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (practice.status === AI_MENTOR_PRACTICE_STATUSES.FAILED) {
    return (
      <PageWrapper
        breadcrumbs={breadcrumbs}
        className="flex min-h-80 flex-col items-center justify-center gap-4"
      >
        <p>{t("aiMentorPractice.failed")}</p>
        <Button disabled={isRetrying} onClick={() => void retryPractice(practice.id)}>
          {t("aiMentorPractice.retry")}
        </Button>
      </PageWrapper>
    );
  }

  return (
    <AiMentorPracticeConversation
      id={practice.id}
      threadId={practice.threadId}
      threadStatus={practice.threadStatus}
      title={practice.title}
      aiMentorName={practice.aiMentorName}
      taskGoal={practice.taskGoal}
      evaluation={practice.evaluation}
    />
  );
}
