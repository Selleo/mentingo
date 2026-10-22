import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useDownloadCompetenciesAttachment } from "~/api/mutations/useDownloadCompetenciesAttachment";
import { useCompetencyRecords } from "~/api/queries/useCompetencyRecords";
import { Pagination } from "~/components/Pagination/Pagination";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { COMPETENCIES_HANDLES } from "../../../../e2e/data/competencies/handles";
import { getSubjectDocumentSteps } from "../competenciesPlans.utils";
import { CompetenciesLoading, CompetenciesError } from "../CompetenciesStates";

import { CompetencyEvidenceForm } from "./CompetencyEvidenceForm";

import type { Competency, CompetencyCondition, CompetenciesWorkspace } from "../competencies.types";

export function CompetenciesDocuments({
  workspace,
  subjectId,
  userId,
}: {
  workspace: CompetenciesWorkspace;
  subjectId: string;
  userId: string;
}) {
  const { t, i18n } = useTranslation();
  const { mutateAsync: download, isPending } = useDownloadCompetenciesAttachment();
  const [submission, setSubmission] = useState<{
    competency: Competency;
    condition: CompetencyCondition;
    actionId?: string;
  } | null>(null);
  const person = workspace.people.find((item) => item.id === subjectId);
  const canSubmit = Boolean(person && !person.archived && (subjectId === userId || person.canPlan));
  const required = getSubjectDocumentSteps(workspace, subjectId);
  const [page, setPage] = useState(1);
  const recordsQuery = useCompetencyRecords(
    { kind: "documents", subjectId, page: String(page), pageSize: "10" },
    subjectId !== userId && Boolean(person),
  );
  const records = recordsQuery.data?.evidence ?? [];

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-neutral-950">
          {t("competencies.requiredDocuments")}
        </h2>
        {!required.length && (
          <p className="mt-3 text-sm text-neutral-800">{t("competencies.noRequiredDocuments")}</p>
        )}
        <ul className="mt-4 divide-y divide-neutral-200">
          {required.map(({ definition, level, condition, pending }) => (
            <li
              key={`${definition.id}:${condition.id}`}
              data-testid={COMPETENCIES_HANDLES.DOCUMENT(definition.id, condition.id)}
              className="flex flex-wrap items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 basis-full space-y-2 sm:basis-0 sm:flex-1">
                <p className="text-xs font-medium text-neutral-700">
                  {definition.name} - {level.name}
                </p>
                <h3 className="text-sm font-semibold text-neutral-950">{condition.description}</h3>
                {pending && <Badge variant="inProgress">{t("competencies.status.pending")}</Badge>}
              </div>
              {canSubmit && (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    setSubmission({
                      competency: definition,
                      condition,
                      actionId: workspace.actions.find(
                        (action) =>
                          action.subjectId === subjectId &&
                          action.competencyId === definition.id &&
                          action.levelId === level.id &&
                          !["cancelled", "completed"].includes(action.status),
                      )?.id,
                    })
                  }
                >
                  {t("competencies.evidenceAction.document")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>
      {subjectId !== userId && (
        <section className="rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-neutral-950">
            {t("competencies.documentSubmissions")}
          </h2>
          {(recordsQuery.isPending || recordsQuery.isPlaceholderData) && (
            <CompetenciesLoading label={t("competencies.loading")} />
          )}
          {recordsQuery.isError && (
            <CompetenciesError
              title={t("competencies.serviceError")}
              actionLabel={t("competencies.retry")}
              onRetry={() => void recordsQuery.refetch()}
            />
          )}
          {!recordsQuery.isPending && !recordsQuery.isError && !records.length && (
            <p className="mt-3 text-sm text-neutral-800">{t("competencies.noDocuments")}</p>
          )}
          {!recordsQuery.isPlaceholderData && (
            <ul className="mt-4 divide-y divide-neutral-200">
              {records.map((record) => (
                <li key={record.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-medium text-neutral-950">
                      {workspace.catalog.find((item) => item.id === record.competencyId)?.name}
                    </h3>
                    <Badge variant={record.status === "approved" ? "success" : "notStarted"}>
                      {t(`competencies.status.${record.status}`)}
                    </Badge>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm">{record.note}</p>
                  <p className="text-xs text-neutral-700">
                    {formatLocalizedDate(i18n.language, record.occurredAt)}
                  </p>
                  {record.reason && (
                    <p className="whitespace-pre-wrap break-words text-sm text-neutral-800">
                      {record.reason}
                    </p>
                  )}
                  {record.attachmentId && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => void download(record.attachmentId!).catch(() => undefined)}
                    >
                      {t("competencies.downloadEvidence")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {(recordsQuery.data?.total ?? 0) > 0 && (
            <Pagination
              currentPage={page}
              itemsPerPage={10}
              totalItems={recordsQuery.data?.total}
              canChangeItemsPerPage={false}
              onPageChange={setPage}
            />
          )}
        </section>
      )}
      {submission && (
        <CompetencyEvidenceForm
          {...submission}
          subjectId={subjectId}
          onClose={() => setSubmission(null)}
        />
      )}
    </div>
  );
}
