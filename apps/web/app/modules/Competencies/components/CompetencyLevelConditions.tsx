import { Link } from "@remix-run/react";
import { Check, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { isConditionExpiring } from "../utils/competenciesExpiry.utils";
import { canVerifyConditions } from "../utils/competenciesVerifiers.utils";
import { COMPETENCY_CONDITION_KINDS } from "../utils/competencyEditor.utils";
import {
  getCompetencyLevelProgress,
  getConditionGuidanceKey,
} from "../utils/competencySubject.utils";

import { CompetencyConditionOverride } from "./CompetencyConditionOverride";

import type { Competency, CompetencyLevel, CompetencyStanding } from "../competencies.types";
import type { CompetencySubjectModel } from "../hooks/competencies-hook-models.types";

type CompetencyLevelConditionsProps = Pick<
  CompetencySubjectModel,
  "setForm" | "setSelectedId" | "workspace" | "subjectId" | "userId" | "canManage"
> & {
  level: CompetencyLevel;
  index: number;
  current: CompetencyLevel | undefined;
  standing: CompetencyStanding;
  definition: Competency;
  verifier: boolean;
};

export function CompetencyLevelConditions({
  setForm,
  setSelectedId,
  workspace,
  subjectId,
  userId,
  canManage,
  level,
  index,
  current,
  standing,
  definition,
  verifier,
}: CompetencyLevelConditionsProps) {
  const { t, i18n } = useTranslation();
  const { confirmed, confirmedRequirements, results } = getCompetencyLevelProgress(
    definition,
    standing,
    level,
  );

  return (
    <AccordionItem
      value={level.id}
      className="overflow-hidden rounded-lg border border-neutral-200"
    >
      <AccordionTrigger className="gap-3 px-4 py-3 text-left hover:bg-neutral-50 [&[data-state=open]>svg]:rotate-180">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            confirmed && "bg-success-50 text-success-700",
            !confirmed && "bg-neutral-100 text-neutral-700",
          )}
        >
          {confirmed ? <Check className="size-4" /> : index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="body-sm-md block text-neutral-950">{level.name}</span>
          <span className="details text-neutral-700">
            {t("competencies.detailGuide.requirementsProgress", {
              completed: confirmedRequirements,
              total: level.conditions.length,
            })}
          </span>
        </span>
        {current?.id === level.id && (
          <Badge variant="success" className="shrink-0 text-xs">
            {t("competencies.currentLevel")}
          </Badge>
        )}
        <ChevronDown
          className="size-4 shrink-0 text-neutral-700 transition-transform"
          aria-hidden="true"
        />
      </AccordionTrigger>
      <AccordionContent className="border-t border-neutral-200 px-4">
        <ul className="divide-y divide-neutral-200">
          {level.conditions.map((condition) => {
            const result = results.find((item) => item.conditionId === condition.id);
            const expiring = isConditionExpiring(result, workspace.asOf, workspace.warningDays);
            return (
              <li key={condition.id} className="flex flex-col gap-3 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="details-md text-neutral-700">
                    {t(`competencies.detailGuide.confirmation.${condition.kind}`)}
                  </span>
                  {expiring && <Badge variant="inProgress">{t("competencies.expiring")}</Badge>}
                  {!expiring && (
                    <Badge variant={result?.met ? "success" : "notStarted"} className="text-xs">
                      {result?.met
                        ? t("competencies.detailGuide.confirmed")
                        : t("competencies.detailGuide.toConfirm")}
                    </Badge>
                  )}
                </div>
                <p className="body-sm-md break-words leading-relaxed text-neutral-950">
                  {condition.description}
                </p>
                {!result?.met && (
                  <p className="body-sm text-neutral-700">
                    {t(getConditionGuidanceKey(condition))}
                  </p>
                )}
                {!result?.met && result?.reason && result.reason !== "missing" && (
                  <p className="details text-neutral-700">
                    {t(`competencies.reason.${result.reason}`)}
                  </p>
                )}
                {result?.effectiveUntil && (
                  <p
                    className={cn(
                      "details text-neutral-700",
                      expiring && "font-medium text-warning-800",
                    )}
                  >
                    {t("competencies.expiresOn", {
                      date: formatLocalizedDate(i18n.language, result.effectiveUntil),
                    })}
                  </p>
                )}
                {condition.kind === COMPETENCY_CONDITION_KINDS.DOCUMENT &&
                  (subjectId === userId || workspace.canPlan) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="self-start"
                      disabled={!condition.verifierIds?.length}
                      onClick={() => {
                        setSelectedId(null);
                        setForm({ competency: definition, recognition: false, condition });
                      }}
                    >
                      {t("competencies.evidenceAction.document")}
                    </Button>
                  )}
                {condition.kind === COMPETENCY_CONDITION_KINDS.OBSERVATION &&
                  verifier &&
                  canVerifyConditions(
                    workspace.competencies,
                    definition.id,
                    [condition.id],
                    userId,
                  ) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="self-start"
                      onClick={() => {
                        setSelectedId(null);
                        setForm({ competency: definition, recognition: false, condition });
                      }}
                    >
                      {t("competencies.evidenceAction.observation")}
                    </Button>
                  )}
                {condition.kind === COMPETENCY_CONDITION_KINDS.COURSE && condition.resourceId && (
                  <Link
                    className="body-sm-md w-fit text-primary-700 underline"
                    to={`/course/${condition.resourceId}`}
                  >
                    {t("competencies.openCourse")}
                  </Link>
                )}
                {canManage && (
                  <CompetencyConditionOverride
                    workspace={workspace}
                    subjectId={subjectId}
                    competency={definition}
                    condition={condition}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </AccordionContent>
    </AccordionItem>
  );
}
