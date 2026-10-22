import { Link } from "@remix-run/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAssignCompetenciesLearning } from "~/api/mutations/useAssignCompetenciesLearning";
import { useExecuteCompetenciesCommand } from "~/api/mutations/useExecuteCompetenciesCommand";
import { useCompetencyRecords } from "~/api/queries/useCompetencyRecords";
import { Pagination } from "~/components/Pagination/Pagination";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "~/components/ui/table";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { COMPETENCIES_HANDLES } from "../../../../e2e/data/competencies/handles";
import { CompetenciesLoading, CompetenciesError } from "../CompetenciesStates";

import { CompetenciesSelect } from "./CompetenciesSelect";

import type { CompetenciesWorkspace, CompetencyAction } from "../competencies.types";

export function CompetenciesActionDetails({
  workspace,
  action,
  canEnroll,
  onDocuments,
  onEdit,
}: {
  workspace: CompetenciesWorkspace;
  action: CompetencyAction;
  canEnroll: boolean;
  onDocuments?: (id: string) => void;
  onEdit: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { mutateAsync: execute, isPending } = useExecuteCompetenciesCommand();
  const { mutateAsync: assign, isPending: assigning } = useAssignCompetenciesLearning();
  const person = workspace.people.find((item) => item.id === action.subjectId);
  const canEdit = Boolean(person && !person.archived && person.canPlan);
  const definition = workspace.catalog.find((item) => item.id === action.competencyId);
  const level = definition?.levels.find((item) => item.id === action.levelId);
  const owner = workspace.people.find((item) => item.id === action.ownerId);
  const metadata = [
    [t("competencies.person"), person?.name ?? t("competencies.archivedAccount")],
    [t("competencies.title"), definition?.name ?? t("competencies.unavailableLevel")],
    [t("competencies.targetLevel"), level?.name ?? t("competencies.unavailableLevel")],
    [t("competencies.owner"), owner?.name ?? t("competencies.archivedAccount")],
    [
      t("competencies.tableDueDate"),
      action.dueDate ? formatLocalizedDate(i18n.language, action.dueDate) : "-",
    ],
  ];
  return (
    <DialogContent
      data-testid={COMPETENCIES_HANDLES.ACTION(action.id)}
      className="min-w-0 max-h-[90vh] max-w-3xl overflow-y-auto"
      aria-describedby={undefined}
    >
      <DialogHeader className="min-w-0">
        <DialogTitle className="break-words pr-6">{action.objective}</DialogTitle>
        <DialogDescription>{t(`competencies.kind.${action.kind}`)}</DialogDescription>
      </DialogHeader>
      <div className="min-w-0 space-y-6">
        <dl className="grid gap-x-8 gap-y-4 border-y border-neutral-200 py-5 sm:grid-cols-2">
          {metadata.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-sm text-neutral-700">{label}</dt>
              <dd className="mt-1 break-words text-sm font-medium text-neutral-950">{value}</dd>
            </div>
          ))}
        </dl>
        {canEdit ? (
          <CompetenciesSelect
            label={t("competencies.actionStatus")}
            value={action.status}
            disabled={isPending}
            options={["planned", "in_progress", "completed", "cancelled"].map((value) => ({
              value,
              label: t(`competencies.status.${value}`),
            }))}
            onChange={(status) =>
              void execute({
                operation: "update_action",
                id: action.id,
                subjectId: action.subjectId,
                version: action.version,
                status: status as CompetencyAction["status"],
                objective: action.objective,
                ownerId: action.ownerId,
                dueDate: action.dueDate,
              }).catch(() => undefined)
            }
          />
        ) : (
          <Badge variant="notStarted">{t(`competencies.status.${action.status}`)}</Badge>
        )}
        {action.kind === "course" && (
          <section className="space-y-3">
            <p className="text-sm text-neutral-800">
              {t(`competencies.assignment.${action.assignmentStatus}`)}
            </p>
            <div className="flex flex-wrap gap-2">
              {action.courseId && (
                <Button variant="outline" asChild>
                  <Link to={`/course/${action.courseId}`}>{t("competencies.openCourse")}</Link>
                </Button>
              )}
              {canEdit &&
                canEnroll &&
                action.status !== "cancelled" &&
                action.assignmentStatus !== "confirmed" && (
                  <Button
                    variant="outline"
                    disabled={assigning}
                    onClick={() =>
                      void assign({
                        id: action.id,
                        subjectId: action.subjectId,
                        requestId: action.assignmentRequestId ?? crypto.randomUUID(),
                      }).catch(() => undefined)
                    }
                  >
                    {t(
                      action.assignmentStatus === "not_requested"
                        ? "competencies.assignCourse"
                        : "competencies.retryAssignment",
                    )}
                  </Button>
                )}
            </div>
          </section>
        )}
        <CompetenciesActionRecords
          key={`${action.id}:history`}
          action={action}
          workspace={workspace}
          kind="action-history"
        />
        <CompetenciesActionRecords
          key={`${action.id}:evidence`}
          action={action}
          workspace={workspace}
          kind="action-evidence"
        />
      </div>
      <DialogFooter className="gap-2 border-t border-neutral-200 pt-4 sm:gap-2">
        {canEdit &&
          definition &&
          !definition.archived &&
          onDocuments &&
          definition.levels.some((item) =>
            item.conditions.some((condition) => condition.kind === "document"),
          ) && (
            <Button variant="outline" onClick={() => onDocuments(action.subjectId)}>
              {t("competencies.documents")}
            </Button>
          )}
        {canEdit && (
          <Button disabled={isPending} onClick={onEdit}>
            {t("competencies.edit")}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}

function CompetenciesActionRecords({
  action,
  workspace,
  kind,
}: {
  action: CompetencyAction;
  workspace: CompetenciesWorkspace;
  kind: "action-history" | "action-evidence";
}) {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState(1);
  const query = useCompetencyRecords({
    kind,
    actionId: action.id,
    subjectId: action.subjectId,
    page: String(page),
    pageSize: "10",
  });
  if (!query.isPending && !query.isError && !query.data?.total) return null;
  return (
    <section className="min-w-0 space-y-3">
      <h3 className="text-base font-semibold text-neutral-950">
        {t(kind === "action-history" ? "competencies.history" : "competencies.evidenceHistory")}
      </h3>
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
      {query.data && !query.isPlaceholderData && (
        <>
          {kind === "action-history" && (
            <Table aria-label={t("competencies.history")}>
              <TableHeader>
                <TableRow>
                  {["objective", "owner", "tableDueDate", "tableStatus"].map((key) => (
                    <TableHead key={key}>{t(`competencies.${key}`)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.actions.map((item) => (
                  <TableRow key={item.version}>
                    <TableCell className="min-w-48 whitespace-pre-wrap break-words">
                      {item.objective}
                    </TableCell>
                    <TableCell>
                      {(query.data?.people ?? []).find((person) => person.id === item.ownerId)
                        ?.name ??
                        workspace.people.find((person) => person.id === item.ownerId)?.name ??
                        t("competencies.archivedAccount")}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {item.dueDate ? formatLocalizedDate(i18n.language, item.dueDate) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="notStarted" className="whitespace-nowrap">
                        {t(`competencies.status.${item.status}`)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {kind === "action-evidence" && (
            <ul className="divide-y divide-neutral-200">
              {query.data.evidence.map((item) => (
                <li key={item.id} className="space-y-2 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {t(
                        item.kind === "recognition"
                          ? "competencies.recordKinds.recognition"
                          : `competencies.kind.${item.kind}`,
                      )}
                    </span>
                    <Badge variant="notStarted">{t(`competencies.status.${item.status}`)}</Badge>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm">{item.note}</p>
                  <p className="text-xs text-neutral-700">
                    {formatLocalizedDate(i18n.language, item.occurredAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {query.data.total > 10 && (
            <Pagination
              currentPage={page}
              itemsPerPage={10}
              totalItems={query.data.total}
              canChangeItemsPerPage={false}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </section>
  );
}
