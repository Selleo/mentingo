import { ClipboardCheck, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDownloadCompetenciesAttachment } from "~/api/mutations/useDownloadCompetenciesAttachment";
import { useExecuteCompetenciesCommand } from "~/api/mutations/useExecuteCompetenciesCommand";
import { useCompetencyRecords } from "~/api/queries/useCompetencyRecords";
import { Pagination } from "~/components/Pagination/Pagination";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { COMPETENCIES_HANDLES } from "../../../../e2e/data/competencies/handles";
import { CompetenciesError, CompetenciesLoading } from "../CompetenciesStates";
import { canVerifyConditions } from "../competenciesVerifiers.utils";

import type { CompetenciesWorkspace, CompetencyEvidence } from "../competencies.types";

export function CompetenciesReview({
  workspace,
  userId,
  onSubject,
}: {
  workspace: CompetenciesWorkspace;
  userId: string;
  onSubject: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { mutateAsync: execute, isPending } = useExecuteCompetenciesCommand();
  const { mutateAsync: download } = useDownloadCompetenciesAttachment();
  const [decision, setDecision] = useState<{
    evidence: CompetencyEvidence;
    status: "approved" | "rejected" | "revoked";
    requestId: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [pendingPage, setPendingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const pending = useCompetencyRecords({
    kind: "review-pending",
    page: String(pendingPage),
    pageSize: "10",
  });
  const history = useCompetencyRecords({
    kind: "review-history",
    page: String(historyPage),
    pageSize: "10",
  });
  useEffect(() => {
    if (pending.data && !pending.isPlaceholderData)
      setPendingPage((page) => Math.min(page, Math.max(1, Math.ceil(pending.data.total / 10))));
    if (history.data && !history.isPlaceholderData)
      setHistoryPage((page) => Math.min(page, Math.max(1, Math.ceil(history.data.total / 10))));
  }, [pending.data, pending.isPlaceholderData, history.data, history.isPlaceholderData]);
  const canRead = (item: CompetencyEvidence) =>
    item.subjectId !== userId &&
    canVerifyConditions(workspace, item.competencyId, item.conditionIds, userId) &&
    workspace.catalog.some(
      (definition) => definition.id === item.competencyId && !definition.archived,
    ) &&
    ["pending", "approved", "rejected", "revoked"].includes(item.status);
  const groups = [
    { id: "pending", query: pending, page: pendingPage, onPageChange: setPendingPage },
    { id: "history", query: history, page: historyPage, onPageChange: setHistoryPage },
  ];
  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ id, query, page, onPageChange }) => (
        <section
          key={id}
          className="flex flex-col gap-4"
          aria-label={t(id === "pending" ? "competencies.review" : "competencies.evidenceHistory")}
        >
          {id === "history" && (
            <h2 className="text-base font-semibold text-neutral-950">
              {t("competencies.evidenceHistory")}
            </h2>
          )}
          {(query.isPending || query.isPlaceholderData) && (
            <CompetenciesLoading label={t("competencies.loading")} />
          )}
          {query.isError && (
            <CompetenciesError
              title={t("competencies.serviceError")}
              actionLabel={t("competencies.retry")}
              onRetry={() => void query.refetch()}
            />
          )}
          {!query.isPending && !query.isError && !query.data?.total && id === "pending" && (
            <p className="rounded-lg border border-neutral-200 bg-white p-10 text-center text-sm text-neutral-800">
              {t("competencies.noEvidence")}
            </p>
          )}
          {!query.isPlaceholderData &&
            query.data?.evidence.filter(canRead).map((item) => (
              <article
                key={item.id}
                data-testid={COMPETENCIES_HANDLES.EVIDENCE(item.id)}
                className="group rounded-lg border border-neutral-200 bg-white"
              >
                <header className="flex flex-wrap items-center gap-3 p-5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-800">
                    <ClipboardCheck className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-neutral-950">
                      {workspace.people.find((person) => person.id === item.subjectId)?.name ??
                        t("competencies.archivedAccount")}
                    </h3>
                    <p className="mt-1 text-sm text-neutral-800">
                      {workspace.catalog.find((value) => value.id === item.competencyId)?.name} -{" "}
                      {formatLocalizedDate(i18n.language, item.occurredAt)}
                    </p>
                  </div>
                  <Badge
                    variant={item.status === "pending" ? "inProgress" : "notStarted"}
                    className="w-fit whitespace-nowrap rounded-full text-xs"
                  >
                    {t(`competencies.status.${item.status}`)}
                  </Badge>
                </header>
                <div className="flex flex-col gap-4 border-t border-neutral-200 p-5">
                  <p className="whitespace-pre-wrap break-words rounded-lg bg-neutral-50 p-4 text-sm leading-relaxed">
                    {item.note}
                  </p>
                  <ul className="list-inside list-disc space-y-1 text-sm text-neutral-800">
                    {workspace.catalog
                      .find((value) => value.id === item.competencyId)
                      ?.levels.flatMap((level) => level.conditions)
                      .filter((condition) => item.conditionIds.includes(condition.id))
                      .map((condition) => <li key={condition.id}>{condition.description}</li>)}
                  </ul>
                  {item.validUntil && (
                    <p className="text-sm">
                      {t("competencies.expiresOn", {
                        date: formatLocalizedDate(i18n.language, item.validUntil),
                      })}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {workspace.people.some(
                      (person) => person.id === item.subjectId && !person.archived,
                    ) && (
                      <Button variant="outline" size="sm" onClick={() => onSubject(item.subjectId)}>
                        {t("competencies.viewDetails")}
                      </Button>
                    )}
                    {item.attachmentId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void download(item.attachmentId!).catch(() => undefined)}
                      >
                        <Download className="mr-2 size-4" aria-hidden="true" />
                        {t("competencies.downloadEvidence")}
                      </Button>
                    )}
                    {workspace.people.some(
                      (person) => person.id === item.subjectId && !person.archived,
                    ) &&
                      (item.status === "pending" || item.status === "approved") &&
                      (item.status === "pending"
                        ? (["approved", "rejected"] as const)
                        : (["revoked"] as const)
                      ).map((status) => (
                        <Button
                          key={status}
                          variant={status === "approved" ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setReason("");
                            setDecision({ evidence: item, status, requestId: crypto.randomUUID() });
                          }}
                        >
                          {t(`competencies.decision.${status}`)}
                        </Button>
                      ))}
                  </div>
                </div>
              </article>
            ))}
          {query.data && query.data.total > 10 && (
            <Pagination
              currentPage={page}
              totalItems={query.data.total}
              itemsPerPage={10}
              canChangeItemsPerPage={false}
              onPageChange={onPageChange}
            />
          )}
        </section>
      ))}
      {decision &&
        workspace.people.some(
          (person) => person.id === decision.evidence.subjectId && !person.archived,
        ) && (
          <Dialog
            open
            onOpenChange={(open) => {
              if (!open && !isPending) setDecision(null);
            }}
          >
            <DialogContent aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle>{t(`competencies.decision.${decision.status}`)}</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  try {
                    await execute({
                      operation: "review_evidence",
                      id: decision.evidence.id,
                      subjectId: decision.evidence.subjectId,
                      version: decision.evidence.version,
                      decision: decision.status,
                      reason,
                      requestId: decision.requestId,
                    });
                    setDecision(null);
                  } catch {
                    /* Keep the reason for review. */
                  }
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="review-reason">{t("competencies.reasonLabel")}</Label>
                  <Textarea
                    id="review-reason"
                    required
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </div>
                <DialogFooter className="gap-2 border-t border-neutral-200 pt-4 sm:gap-0">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => setDecision(null)}
                  >
                    {t("competencies.cancel")}
                  </Button>
                  <Button type="submit" disabled={isPending || !reason.trim()}>
                    {t(`competencies.decision.${decision.status}`)}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
    </div>
  );
}
