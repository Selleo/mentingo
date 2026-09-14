import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import { AI_CONVERSATIONS_HANDLES } from "../../../../e2e/data/ai-conversations/handles";

import { ConversationStatus } from "./ConversationStatus";

import type { GetAdminAiThreadDetailsResponse } from "~/api/generated-api";

export function ConversationDetails({
  thread,
  onEvaluation,
}: {
  thread: GetAdminAiThreadDetailsResponse["data"];
  onEvaluation: () => void;
}) {
  const { t, i18n } = useTranslation();
  const formatDate = (value: string) =>
    new Date(value).toLocaleString(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  const language =
    new Intl.DisplayNames([i18n.language], { type: "language" }).of(thread.language) ??
    thread.language;
  const rows = [
    {
      label: t("aiConversations.owner"),
      value: `${thread.owner.firstName} ${thread.owner.lastName}`,
    },
    { label: t("aiConversations.type"), value: t(`aiConversations.types.${thread.type}`) },
    { label: t("aiConversations.status"), value: <ConversationStatus status={thread.status} /> },
    ...(thread.courseTitle
      ? [{ label: t("aiConversations.source"), value: thread.courseTitle }]
      : []),
    { label: t("aiConversations.language"), value: language },
    {
      label: t("aiConversations.started"),
      value: formatDate(thread.createdAt),
    },
    {
      label: t("aiConversations.lastActivity"),
      value: formatDate(thread.lastActivityAt),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl">
      <dl className="divide-y divide-neutral-100">
        {rows.map(({ label, value }) => (
          <div key={label} className="grid gap-1 py-4 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-6">
            <dt className="body-sm text-neutral-600">{label}</dt>
            <dd className="body-sm-md min-w-0 break-words text-neutral-950">{value}</dd>
          </div>
        ))}
      </dl>
      {thread.evaluation && (
        <section className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-neutral-200 pt-6">
          <div className="flex items-baseline gap-1 text-neutral-950">
            <span className="body-base-md tabular-nums">{thread.evaluation.score}</span>
            <span className="body-base text-neutral-700">/ {thread.evaluation.maxScore}</span>
          </div>
          <Button
            variant="outline"
            data-testid={AI_CONVERSATIONS_HANDLES.RESULT}
            onClick={onEvaluation}
          >
            {t("aiConversations.result")}
          </Button>
        </section>
      )}
    </div>
  );
}
