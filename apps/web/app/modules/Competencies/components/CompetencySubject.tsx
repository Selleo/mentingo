import { Link } from "@remix-run/react";
import { ArrowRight, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDownloadCompetenciesAttachment } from "~/api/mutations/useDownloadCompetenciesAttachment";
import { useExecuteCompetenciesCommand } from "~/api/mutations/useExecuteCompetenciesCommand";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "~/components/ui/table";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { COMPETENCIES_HANDLES } from "../../../../e2e/data/competencies/handles";
import { isConditionExpiring } from "../competenciesExpiry.utils";
import { getSubjectPlanActions, getSubjectRequiredSteps } from "../competenciesPlans.utils";
import { canVerifyConditions } from "../competenciesVerifiers.utils";

import { CompetenciesSelect } from "./CompetenciesSelect";
import { CompetencyEvidenceForm } from "./CompetencyEvidenceForm";
import { CompetencyExpiryDetails } from "./CompetencyExpiryDetails";
import { CompetencyRevocationForm } from "./CompetencyRevocationForm";

import type { Competency, CompetencyCondition, CompetenciesWorkspace } from "../competencies.types";

export function CompetencySubject({
  workspace,
  subjectId,
  userId,
  onPlan,
  canManage = false,
}: {
  workspace: CompetenciesWorkspace;
  subjectId: string;
  userId: string;
  onPlan: () => void;
  canManage?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { mutateAsync: download, isPending } = useDownloadCompetenciesAttachment();
  const [form, setForm] = useState<{
    competency: Competency;
    recognition: boolean;
    condition?: CompetencyCondition;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revocation, setRevocation] = useState<{
    competency: Competency;
    conditions: CompetencyCondition[];
  } | null>(null);
  const assessment = workspace.assessments.find((item) => item.subjectId === subjectId);
  const standings = workspace.standings.filter((item) => item.subjectId === subjectId);
  const records = workspace.evidence.filter((item) => item.subjectId === subjectId);
  const personName =
    workspace.people.find((person) => person.id === subjectId)?.name ??
    t("competencies.archivedAccount");
  let summaryMessage = t("competencies.noProfile");
  if (assessment && assessment.coverage !== null) {
    summaryMessage = t(
      assessment.metCount === assessment.requirementCount
        ? "competencies.allRequirementsMet"
        : "competencies.needsAttention",
    );
  }
  const activeActions = getSubjectPlanActions(workspace, subjectId)
    .filter((item) => item.status !== "completed")
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const nextAction = activeActions[0];
  const nextRequiredStep = getSubjectRequiredSteps(workspace, subjectId)[0];
  const nextObjective = nextAction?.objective ?? nextRequiredStep?.condition.description;
  let nextDescription = t("competencies.employee.noNextStep");
  if (nextRequiredStep) {
    nextDescription = nextRequiredStep.definition.name;
    if (["observation", "document"].includes(nextRequiredStep.condition.kind))
      nextDescription = t("competencies.employee.requiresConfirmation");
    if (nextRequiredStep.pending) nextDescription = t("competencies.status.pending");
  }
  const definitions = workspace.catalog.filter(
    (definition) =>
      definition.levels.length &&
      standings.some((item) => item.standing.competencyId === definition.id),
  );
  const activeDefinitions = definitions.filter((definition) => !definition.archived);
  const canInspectCompetencies =
    canManage ||
    workspace.people.some((person) => person.id === subjectId && person.canPlan) ||
    activeDefinitions.some((definition) =>
      definition.levels.some((level) =>
        level.conditions.some((condition) =>
          canVerifyConditions(workspace, definition.id, [condition.id], userId),
        ),
      ),
    );
  const remainingDays = (date: string) =>
    Math.max(0, Math.ceil((Date.parse(date) - Date.parse(workspace.asOf)) / 86400000));
  const rows = definitions.map((definition) => {
    const requirement = assessment?.requirements.find(
      (item) => item.requirement.competencyId === definition.id,
    );
    const standing = standings.find(
      (item) => item.standing.competencyId === definition.id,
    )!.standing;
    const currentIndex = definition.levels.findIndex(
      (level) => level.id === standing.currentLevelId,
    );
    const requiredIndex = definition.levels.findIndex(
      (level) => level.id === requirement?.requirement.levelId,
    );
    const target =
      definition.levels[requiredIndex] ??
      definition.levels.find(
        (level) => !standing.levels.find((result) => result.levelId === level.id)?.met,
      ) ??
      definition.levels[currentIndex];
    const results = standing.levels.find((level) => level.levelId === target?.id)?.conditions ?? [];
    const latestRecord = records
      .filter((record) => record.competencyId === definition.id)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
    const latestResult = results
      .filter((result) => result.met && result.effectiveFrom)
      .sort((a, b) => b.effectiveFrom!.localeCompare(a.effectiveFrom!))[0];
    const completedCondition = target?.conditions.find(
      (condition) => condition.id === latestResult?.conditionId,
    );
    let latestEvidence = t("competencies.reason.missing");
    if (completedCondition)
      latestEvidence = `${completedCondition.description}: ${t("competencies.status.completed")}`;
    if (latestRecord)
      latestEvidence = `${t(latestRecord.kind === "recognition" ? "competencies.recordKinds.recognition" : `competencies.kind.${latestRecord.kind}`)}: ${t(`competencies.status.${latestRecord.status}`)}`;
    if (standing.expiring && standing.effectiveUntil)
      latestEvidence = t("competencies.expiresInDays", {
        days: remainingDays(standing.effectiveUntil),
      });
    const action = activeActions.find((item) => item.competencyId === definition.id);
    let actionLabel = t("competencies.employee.gap");
    if (action) actionLabel = t(`competencies.kind.${action.kind}`);
    if (standing.expiring) actionLabel = t("competencies.kind.renewal");
    return {
      definition,
      standing,
      currentIndex,
      requiredIndex,
      latestEvidence,
      actionLabel,
      hasAction: Boolean(action),
      confirmed: (requirement ? requirement.met : currentIndex >= 0) && !standing.expiring,
    };
  });
  const attention = rows.filter((row) => row.requiredIndex >= 0 && !row.confirmed);
  const confirmed = rows.filter((row) => row.confirmed);
  const expiring = rows.filter((row) => row.standing.expiring);
  let statusMessage = t("competencies.noProfile");
  if (assessment && assessment.coverage !== null) {
    statusMessage = t("competencies.employee.statusMet");
    if (assessment.metCount < assessment.requirementCount)
      statusMessage = t("competencies.employee.statusGaps");
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="relative flex flex-wrap items-center gap-4 overflow-hidden rounded-lg border border-neutral-200 bg-white p-5 sm:p-6 before:absolute before:-right-12 before:-top-20 before:size-40 before:rounded-full before:bg-primary-50 before:content-['']">
        <div
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-800"
        >
          {personName
            .split(" ")
            .map((part) => part[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-neutral-950">{personName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{summaryMessage}</p>
        </div>
        {assessment && assessment.coverage !== null && (
          <div className="relative w-full sm:ml-auto sm:w-auto">
            <p className="font-gothic text-2xl font-semibold text-primary-800">
              {t("competencies.requirementsMet", {
                met: assessment.metCount,
                total: assessment.requirementCount,
              })}
            </p>
          </div>
        )}
      </div>
      <section className="flex flex-wrap items-center gap-4 rounded-lg border-2 border-primary-700 bg-white p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-800">
          <ArrowRight className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-neutral-950">
            {t(subjectId === userId ? "competencies.nextAction" : "competencies.nextActionOther")}
            {nextObjective && `: ${nextObjective}`}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {nextAction ? (
              <>
                {workspace.people.find((person) => person.id === nextAction.ownerId)?.name ??
                  t("competencies.archivedAccount")}
                {nextAction.dueDate &&
                  ` - ${formatLocalizedDate(i18n.language, nextAction.dueDate)}`}
              </>
            ) : (
              nextDescription
            )}
          </p>
        </div>
        <Button className="w-full sm:w-auto" onClick={onPlan}>
          {t("competencies.viewDetails")}
        </Button>
      </section>
      {canInspectCompetencies && activeDefinitions.length > 0 && (
        <div className="max-w-sm">
          <CompetenciesSelect
            label={t("competencies.inspectCompetency")}
            value=""
            emptyLabel={t("competencies.inspectCompetency")}
            options={activeDefinitions.map((definition) => ({
              value: definition.id,
              label: definition.name,
            }))}
            onChange={setSelectedId}
          />
        </div>
      )}
      <div className="grid min-w-0 items-stretch gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(16rem,1fr)]">
        <section className="min-w-0 overflow-hidden rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-neutral-950">
                {t("competencies.needsAttention")}
              </h2>
              <Badge variant="draft" className="w-fit rounded-full px-3 py-2 text-xs">
                {t("competencies.employee.count", { count: attention.length })}
              </Badge>
            </div>
            {attention.length > 0 ? (
              <Table aria-label={t("competencies.title")}>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead scope="col" className="pl-0 text-xs font-normal">
                      {t("competencies.recordKinds.competency")}
                    </TableHead>
                    <TableHead scope="col" className="text-xs font-normal">
                      {t("competencies.levelComparison")}
                    </TableHead>
                    <TableHead scope="col" className="text-xs font-normal">
                      {t("competencies.employee.latestEvidence")}
                    </TableHead>
                    <TableHead scope="col" className="pr-0 text-xs font-normal">
                      {t("competencies.employee.whatsNext")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attention.map(
                    ({
                      definition,
                      standing,
                      currentIndex,
                      requiredIndex,
                      latestEvidence,
                      actionLabel,
                      hasAction,
                    }) => {
                      return (
                        <TableRow
                          key={definition.id}
                          data-testid={COMPETENCIES_HANDLES.ROW(definition.id)}
                        >
                          <TableCell className="min-w-40 pl-0 font-medium">
                            <Button
                              variant="link"
                              className="h-auto whitespace-normal rounded p-0 text-left font-normal text-neutral-800"
                              aria-label={`${t("competencies.viewDetails")}: ${definition.name}`}
                              onClick={() => setSelectedId(definition.id)}
                            >
                              {definition.name}
                            </Button>
                          </TableCell>
                          <TableCell className="min-w-32 whitespace-nowrap text-neutral-800">
                            {currentIndex >= 0 ? `L${currentIndex + 1}` : "-"} /{" "}
                            {`L${requiredIndex + 1}`}
                          </TableCell>
                          <TableCell className="min-w-36">
                            {latestEvidence}
                            {standing.expiring && (
                              <CompetencyExpiryDetails
                                definition={definition}
                                standing={standing}
                                workspace={workspace}
                              />
                            )}
                          </TableCell>
                          <TableCell className="pr-0">
                            <Badge
                              variant="outline"
                              className={cn(
                                "w-fit rounded-full px-3 py-2 text-xs",
                                (standing.expiring || hasAction) &&
                                  "bg-warning-50 text-warning-800",
                                !standing.expiring && !hasAction && "bg-error-50 text-error-800",
                              )}
                            >
                              {actionLabel}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    },
                  )}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm leading-relaxed text-neutral-800">
                {t(assessment?.profileId ? "competencies.noAttention" : "competencies.noProfile")}
              </p>
            )}
          </>
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-neutral-950">
                {t("competencies.confirmed")}
              </h2>
              <Badge variant="successFilled" className="rounded-full px-3 py-2 text-xs">
                {t("competencies.employee.count", { count: confirmed.length })}
              </Badge>
            </div>
            <p className="text-sm leading-relaxed text-neutral-800">
              {confirmed.map(({ definition }, index) => (
                <span key={definition.id} data-testid={COMPETENCIES_HANDLES.ROW(definition.id)}>
                  {index > 0 && ", "}
                  <Button
                    variant="link"
                    className="inline h-auto whitespace-normal rounded p-0 text-left font-normal text-neutral-800"
                    aria-label={`${t("competencies.viewDetails")}: ${definition.name}`}
                    onClick={() => setSelectedId(definition.id)}
                  >
                    {definition.name}
                  </Button>
                </span>
              ))}
              {confirmed.length > 0 ? "." : t("competencies.employee.noConfirmed")}
            </p>
          </div>
        </section>
        <aside className="min-w-0 rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-neutral-950">
            {t("competencies.statusMeaning")}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-neutral-800">{statusMessage}</p>
          <div className="mt-6">
            <h3 className="border-b border-neutral-200 pb-3 text-lg font-semibold">
              {t("competencies.expiring")}
            </h3>
            {expiring.map(({ definition, standing }) => (
              <div key={definition.id} className="mt-4 flex flex-wrap items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning-50 text-warning-800">
                  <RotateCw className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1 break-words text-sm">
                  <span className="block font-medium">{definition.name}</span>
                  {standing.effectiveUntil && (
                    <span className="mt-1 block font-normal leading-relaxed text-neutral-800">
                      {t("competencies.employee.validForDays", {
                        days: remainingDays(standing.effectiveUntil),
                      })}
                    </span>
                  )}
                  <CompetencyExpiryDetails
                    definition={definition}
                    standing={standing}
                    workspace={workspace}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  aria-label={`${t("competencies.viewDetails")}: ${definition.name}`}
                  onClick={() => setSelectedId(definition.id)}
                >
                  {t("competencies.viewDetails")}
                </Button>
              </div>
            ))}
            {expiring.length === 0 && (
              <p className="mt-4 text-sm leading-relaxed text-neutral-800">
                {t("competencies.employee.noExpiring")}
              </p>
            )}
          </div>
        </aside>
      </div>
      <Dialog
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {activeDefinitions.find((item) => item.id === selectedId)?.name}
            </DialogTitle>
            <DialogDescription>
              {activeDefinitions.find((item) => item.id === selectedId)?.description}
            </DialogDescription>
          </DialogHeader>
          {activeDefinitions
            .filter((definition) => definition.id === selectedId)
            .map((definition) => {
              const standing = standings.find(
                (item) => item.standing.competencyId === definition.id,
              )!.standing;
              const current = definition.levels.find(
                (level) => level.id === standing.currentLevelId,
              );
              const attained = definition.levels.find(
                (level) => level.id === standing.attainedLevelId,
              );
              const attainedLevelName =
                attained?.name ??
                (standing as typeof standing & { attainedLevelName?: string }).attainedLevelName;
              const verifiableLevels = definition.levels
                .map((level) => ({
                  ...level,
                  conditions: level.conditions.filter((condition) =>
                    canVerifyConditions(workspace, definition.id, [condition.id], userId),
                  ),
                }))
                .filter((level) => level.conditions.length > 0);
              const verifier = subjectId !== userId && verifiableLevels.length > 0;
              const revocableConditions = definition.levels
                .slice(0, definition.levels.findIndex((level) => level.id === current?.id) + 1)
                .flatMap((level) => level.conditions)
                .filter((condition) =>
                  canVerifyConditions(workspace, definition.id, [condition.id], userId),
                );
              const evidence = records.filter((item) => item.competencyId === definition.id);
              return (
                <section key={definition.id} className="flex min-w-0 flex-col gap-4">
                  <dl className="grid gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <dt className="text-xs font-medium text-neutral-700">
                        {t("competencies.currentLevel")}
                      </dt>
                      <dd className="font-semibold text-neutral-950">
                        {current?.name ?? t("competencies.missing")}
                      </dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-xs font-medium text-neutral-700">
                        {t("competencies.category")}
                      </dt>
                      <dd className="text-sm text-neutral-950">{definition.category}</dd>
                    </div>
                  </dl>
                  {attainedLevelName && attainedLevelName !== current?.name && (
                    <p className="text-sm">
                      {t("competencies.attainedLevel", { level: attainedLevelName })}
                    </p>
                  )}
                  {standing.effectiveFrom && (
                    <p className="text-sm">
                      {t("competencies.confirmedFrom", {
                        date: formatLocalizedDate(i18n.language, standing.effectiveFrom),
                      })}
                    </p>
                  )}
                  {standing.effectiveUntil && (
                    <p className="text-sm">
                      {t("competencies.expiresOn", {
                        date: formatLocalizedDate(i18n.language, standing.effectiveUntil),
                      })}
                      {standing.expiring && (
                        <span className="ml-2 font-medium">{t("competencies.expiring")}</span>
                      )}
                    </p>
                  )}
                  <div className="text-sm">
                    <h3 className="text-base font-semibold text-neutral-950">
                      {t("competencies.levelRequirements")}
                    </h3>
                    <div className="mt-3 flex flex-col gap-4">
                      {definition.levels.map((level, index) => (
                        <section
                          key={level.id}
                          className="overflow-hidden rounded-lg border border-neutral-200"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 bg-neutral-50 px-4 py-3">
                            <h4 className="font-semibold text-neutral-950">
                              {t("competencies.numberedLevel", {
                                number: index + 1,
                                name: level.name,
                              })}
                            </h4>
                            {current?.id === level.id && (
                              <Badge variant="success">{t("competencies.currentLevel")}</Badge>
                            )}
                          </div>
                          <ul className="divide-y divide-neutral-200 px-4">
                            {level.conditions.map((condition) => {
                              const result = standing.levels
                                .find((item) => item.levelId === level.id)
                                ?.conditions.find((item) => item.conditionId === condition.id);
                              const expiring = isConditionExpiring(
                                result,
                                workspace.asOf,
                                workspace.warningDays,
                              );
                              return (
                                <li
                                  key={condition.id}
                                  className="flex flex-wrap items-start justify-between gap-3 py-4"
                                >
                                  <div className="min-w-0 basis-full space-y-1 sm:basis-0 sm:flex-1">
                                    <p className="text-xs font-medium text-neutral-700">
                                      {t(`competencies.kind.${condition.kind}`)}
                                    </p>
                                    <p className="break-words leading-relaxed text-neutral-950">
                                      {condition.description}
                                    </p>
                                    {result?.effectiveUntil && (
                                      <p
                                        className={cn(
                                          "text-xs leading-relaxed text-neutral-700",
                                          expiring && "font-medium text-warning-800",
                                        )}
                                      >
                                        {t("competencies.expiresOn", {
                                          date: formatLocalizedDate(
                                            i18n.language,
                                            result.effectiveUntil,
                                          ),
                                        })}
                                      </p>
                                    )}
                                  </div>
                                  {expiring ? (
                                    <Badge variant="inProgress">{t("competencies.expiring")}</Badge>
                                  ) : (
                                    <Badge variant={result?.met ? "success" : "notStarted"}>
                                      {result?.met
                                        ? t("competencies.met")
                                        : t(`competencies.reason.${result?.reason ?? "missing"}`)}
                                    </Badge>
                                  )}
                                  {condition.kind === "document" &&
                                    (subjectId === userId ||
                                      workspace.people.some(
                                        (person) =>
                                          person.id === subjectId &&
                                          !person.archived &&
                                          person.canPlan,
                                      )) && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedId(null);
                                          setForm({
                                            competency: definition,
                                            recognition: false,
                                            condition,
                                          });
                                        }}
                                      >
                                        {t("competencies.evidenceAction.document")}
                                      </Button>
                                    )}
                                  {condition.kind === "observation" &&
                                    verifier &&
                                    canVerifyConditions(
                                      workspace,
                                      definition.id,
                                      [condition.id],
                                      userId,
                                    ) && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedId(null);
                                          setForm({
                                            competency: definition,
                                            recognition: false,
                                            condition,
                                          });
                                        }}
                                      >
                                        {t("competencies.evidenceAction.observation")}
                                      </Button>
                                    )}
                                  {canManage && (
                                    <CompetencyConditionOverride
                                      workspace={workspace}
                                      subjectId={subjectId}
                                      competency={definition}
                                      condition={condition}
                                    />
                                  )}
                                  {condition.kind === "course" && condition.resourceId && (
                                    <Link
                                      className="w-full underline"
                                      to={`/course/${condition.resourceId}`}
                                    >
                                      {t("competencies.openCourse")}
                                    </Link>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </section>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {verifier && !definition.archived && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedId(null);
                          setForm({
                            competency: { ...definition, levels: verifiableLevels },
                            recognition: true,
                          });
                        }}
                      >
                        {t("competencies.recognize")}
                      </Button>
                    )}
                    {revocableConditions.length > 0 && current && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedId(null);
                          setRevocation({
                            competency: definition,
                            conditions: revocableConditions,
                          });
                        }}
                      >
                        {t("competencies.revokeConfirmation")}
                      </Button>
                    )}
                  </div>
                  {(canManage || subjectId !== userId) && (
                    <>
                      <h3 className="border-t border-neutral-200 pt-4 text-base font-semibold text-neutral-950">
                        {t("competencies.evidenceHistory")}
                      </h3>
                      {evidence.map((item) => (
                        <div key={item.id} className="border-t pt-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span>{t(`competencies.status.${item.status}`)}</span>
                            <span className="text-muted-foreground">
                              {formatLocalizedDate(i18n.language, item.occurredAt)}
                            </span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap break-words">{item.note}</p>
                          {item.validUntil && (
                            <p className="mt-1 text-muted-foreground">
                              {t("competencies.expiresOn", {
                                date: formatLocalizedDate(i18n.language, item.validUntil),
                              })}
                            </p>
                          )}
                          {item.reason && (
                            <p className="mt-1 text-muted-foreground">{item.reason}</p>
                          )}
                          {item.attachmentId && (
                            <Button
                              variant="link"
                              size="sm"
                              disabled={isPending}
                              onClick={() =>
                                void download(item.attachmentId!).catch(() => undefined)
                              }
                            >
                              {t("competencies.downloadEvidence")}
                            </Button>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </section>
              );
            })}
        </DialogContent>
      </Dialog>
      {form && (
        <CompetencyEvidenceForm
          competency={form.competency}
          subjectId={subjectId}
          recognition={form.recognition}
          condition={form.condition}
          onClose={() => setForm(null)}
        />
      )}
      {revocation && (
        <CompetencyRevocationForm
          competency={revocation.competency}
          conditions={revocation.conditions}
          subjectId={subjectId}
          onClose={() => setRevocation(null)}
        />
      )}
    </div>
  );
}

type ConditionOverride = CompetenciesWorkspace["conditionOverrides"][number];

function CompetencyConditionOverride({
  workspace,
  subjectId,
  competency,
  condition,
}: {
  workspace: CompetenciesWorkspace;
  subjectId: string;
  competency: Competency;
  condition: CompetencyCondition;
}) {
  const { t, i18n } = useTranslation();
  const { mutateAsync: execute, isPending } = useExecuteCompetenciesCommand();
  const overrides = workspace.conditionOverrides;
  const history = overrides
    .filter(
      (item) =>
        item.subjectId === subjectId &&
        item.competencyId === competency.id &&
        item.conditionId === condition.id,
    )
    .reverse();
  const current = history.find((item) => item.isCurrent);
  const [status, setStatus] = useState<ConditionOverride["status"]>(current?.status ?? "automatic");
  const [comment, setComment] = useState(current?.comment ?? "");
  useEffect(() => {
    setStatus(current?.status ?? "automatic");
    setComment(current?.comment ?? "");
  }, [
    subjectId,
    competency.id,
    competency.revision,
    condition.id,
    current?.id,
    current?.status,
    current?.comment,
  ]);
  return (
    <div className="w-full rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <details>
        <summary className="cursor-pointer text-xs font-medium text-primary-800">
          {t("competencies.overrideCondition")}
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <CompetenciesSelect
            label={t("competencies.overrideStatus")}
            value={status}
            options={[
              { value: "automatic", label: t("competencies.overrideAutomatic") },
              { value: "met", label: t("competencies.overrideMet") },
            ]}
            onChange={(value) => setStatus(value as ConditionOverride["status"])}
            disabled={isPending}
          />
          <div className="space-y-2">
            <Label htmlFor={`override-comment-${condition.id}`}>
              {t("competencies.overrideComment")}
            </Label>
            <Textarea
              id={`override-comment-${condition.id}`}
              required
              value={comment}
              disabled={isPending}
              onChange={(event) => setComment(event.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="self-start"
            disabled={isPending || !comment.trim()}
            onClick={() =>
              void execute({
                operation: "set_condition_override",
                requestId: crypto.randomUUID(),
                subjectId,
                competencyId: competency.id,
                revision: competency.revision,
                conditionId: condition.id,
                status,
                comment: comment.trim(),
              }).catch(() => undefined)
            }
          >
            {t("competencies.saveOverride")}
          </Button>
        </div>
      </details>
      {history.length > 0 && (
        <details className="mt-3 border-t border-neutral-200 pt-3">
          <summary className="cursor-pointer text-xs font-medium text-neutral-800">
            {t("competencies.overrideHistory")}
          </summary>
          <ul className="mt-2 space-y-2 text-xs text-neutral-800">
            {history.map((item) => {
              const actor = workspace.people.find((person) => person.id === item.createdBy)?.name;
              return (
                <li key={item.id}>
                  <span className="font-medium">{t(`competencies.override.${item.status}`)}</span>
                  {" - "}
                  {formatLocalizedDate(i18n.language, item.createdAt)}
                  {actor && <span> - {actor}</span>}
                  <span className="block whitespace-pre-wrap">{item.comment}</span>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}
