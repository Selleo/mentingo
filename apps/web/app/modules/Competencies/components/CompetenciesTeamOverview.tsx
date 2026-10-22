import { CircleAlert, CircleCheck, Clock3 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { CompetencyExpiryDetails } from "./CompetencyExpiryDetails";

import type { CompetenciesWorkspace } from "../competencies.types";

export function CompetenciesTeamOverview({
  workspace,
  onSubject,
  onMatrix,
  onPlans,
  onReview,
  onPlan,
  profileId = "",
}: {
  workspace: CompetenciesWorkspace;
  onSubject: (id: string) => void;
  onMatrix: () => void;
  onPlans: () => void;
  onReview: (subjectId?: string) => void;
  onPlan: (id: string) => void;
  profileId?: string;
}) {
  const { t, i18n } = useTranslation();
  const subjects = workspace.assessments.filter(
    (item) =>
      (!profileId ||
        workspace.subjects.some(
          (subject) => subject.id === item.subjectId && subject.profileId === profileId,
        )) &&
      workspace.people.some((person) => person.id === item.subjectId && person.canPlan),
  );
  const subjectIds = new Set(subjects.map((item) => item.subjectId));
  const missing = subjects.flatMap((assessment) =>
    assessment.requirements
      .filter((item) => !item.met)
      .map((item) => ({ ...item, subjectId: assessment.subjectId })),
  );
  const pending = workspace.evidence.filter(
    (item) =>
      item.status === "pending" &&
      subjectIds.has(item.subjectId) &&
      workspace.catalog.some(
        (definition) => definition.id === item.competencyId && !definition.archived,
      ),
  );
  const expiring = workspace.standings.filter(
    (item) =>
      item.standing.expiring &&
      subjectIds.has(item.subjectId) &&
      workspace.catalog.some(
        (definition) => definition.id === item.standing.competencyId && !definition.archived,
      ),
  );
  const unplannedRenewals = expiring.filter(
    (item) =>
      !workspace.actions.some(
        (action) =>
          action.subjectId === item.subjectId &&
          action.competencyId === item.standing.competencyId &&
          action.kind === "renewal" &&
          ["planned", "in_progress"].includes(action.status),
      ),
  ).length;
  const oldestEvidenceDays = pending.length
    ? Math.max(
        0,
        ...pending.map((item) =>
          Math.floor((Date.parse(workspace.asOf) - Date.parse(item.occurredAt)) / 86400000),
        ),
      )
    : 0;
  const name = (id: string) =>
    workspace.people.find((person) => person.id === id)?.name ?? t("competencies.archivedAccount");
  const competencyName = (id: string) =>
    workspace.catalog.find((item) => item.id === id)?.name ?? "";
  const alerts = [
    ...missing.map((item) => ({
      id: `gap-${item.subjectId}-${item.requirement.competencyId}`,
      subjectId: item.subjectId,
      description: t("competencies.missingConfirmation", {
        name: competencyName(item.requirement.competencyId),
      }),
      icon: CircleAlert,
      action: t("competencies.plan"),
      onClick: () => onPlan(item.subjectId),
      details: null,
    })),
    ...pending.map((item) => ({
      id: item.id,
      subjectId: item.subjectId,
      description: t("competencies.awaitingApproval", { name: competencyName(item.competencyId) }),
      icon: CircleCheck,
      action: t("competencies.check"),
      onClick: () => onSubject(item.subjectId),
      details: null,
    })),
    ...expiring.map((item) => ({
      id: `expiry-${item.subjectId}-${item.standing.competencyId}`,
      subjectId: item.subjectId,
      description: `${competencyName(item.standing.competencyId)} - ${t("competencies.expiresOn", { date: formatLocalizedDate(i18n.language, item.standing.effectiveUntil!) })}`,
      icon: Clock3,
      action: t("competencies.renew"),
      onClick: () => onPlan(item.subjectId),
      details: (
        <CompetencyExpiryDetails
          definition={
            workspace.catalog.find((definition) => definition.id === item.standing.competencyId)!
          }
          standing={item.standing}
          workspace={workspace}
        />
      ),
    })),
  ];
  const summary = [
    {
      label: t("competencies.allRequirementsMet"),
      count: subjects.filter(
        (item) => item.coverage !== null && item.metCount === item.requirementCount,
      ).length,
    },
    {
      label: t("competencies.needsAttention"),
      count: subjects.filter(
        (item) => item.coverage !== null && item.metCount < item.requirementCount,
      ).length,
    },
    {
      label: t("competencies.notEvaluated"),
      count: subjects.filter((item) => item.coverage === null).length,
    },
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: t("competencies.needsAttention"),
            value: subjects.filter(
              (item) => item.coverage !== null && item.metCount < item.requirementCount,
            ).length,
            note: t("competencies.peopleCount", { count: subjects.length }),
            onClick: onMatrix,
          },
          {
            label: t("competencies.missing"),
            value: missing.length,
            note: t("competencies.requirements"),
            onClick: onMatrix,
          },
          {
            label:
              workspace.warningDays === null
                ? t("competencies.expiring")
                : t("competencies.expiresInDays", { days: workspace.warningDays }),
            value: expiring.length,
            note: t("competencies.unplannedRenewals", { count: unplannedRenewals }),
            onClick: onPlans,
          },
          {
            label: t("competencies.waitingApproval"),
            value: pending.length,
            note: pending.length
              ? t("competencies.oldestEvidenceDays", { count: oldestEvidenceDays })
              : t("competencies.noPendingEvidence"),
            onClick: () => onReview(pending[0]?.subjectId),
          },
        ].map((item) => (
          <Button
            key={item.label}
            variant="outline"
            onClick={item.onClick}
            className="h-auto min-h-36 flex-col items-start justify-start whitespace-normal border-neutral-200 bg-white p-5 text-left font-normal hover:border-primary-400 hover:bg-primary-50 hover:opacity-100"
          >
            <span className="text-sm leading-relaxed text-neutral-800">{item.label}</span>
            <span className="font-gothic mt-1 text-3xl font-semibold leading-tight text-primary-950">
              {item.value}
            </span>
            <span className="mt-3 text-xs text-neutral-800">{item.note}</span>
          </Button>
        ))}
      </div>
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(240px,1fr)]">
        <section className="min-w-0 rounded-lg border border-neutral-200 bg-white p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-primary-950">
              {t("competencies.requiresYourAttention")}
            </h2>
            <Button variant="outline" size="sm" onClick={onMatrix}>
              {t("competencies.viewEveryone")}
            </Button>
          </div>
          <div className="max-h-[420px] divide-y divide-neutral-200 overflow-y-auto">
            {alerts.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center gap-3 py-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning-50 text-warning-800">
                  <item.icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-primary-950">{name(item.subjectId)}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-800">
                    {item.description}
                  </p>
                  {item.details}
                </div>
                <Button variant="outline" size="sm" onClick={item.onClick}>
                  {item.action}
                </Button>
              </div>
            ))}
            {!alerts.length && (
              <p className="py-8 text-sm text-neutral-800">{t("competencies.noAttention")}</p>
            )}
          </div>
        </section>
        <section className="min-w-0 rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-primary-950">
            {t("competencies.workReadiness")}
          </h2>
          <div className="divide-y divide-neutral-200 border-t border-neutral-200">
            {summary.map((item) => {
              const percentage = subjects.length
                ? Math.round((item.count / subjects.length) * 100)
                : 0;
              return (
                <div key={item.label} className="flex items-center gap-3 py-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-sm font-semibold text-primary-800">
                    {item.count}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-primary-950">{item.label}</h3>
                    <Progress
                      value={percentage}
                      aria-valuenow={percentage}
                      aria-label={item.label}
                      className="mt-2 h-1.5 bg-primary-50"
                      indicatorClassName="bg-primary-700"
                    />
                  </div>
                  <span className="text-sm font-semibold text-primary-950">{percentage}%</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
