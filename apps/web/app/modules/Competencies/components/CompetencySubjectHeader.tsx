import { useTranslation } from "react-i18next";

import { Progress } from "~/components/ui/progress";
import { cn } from "~/lib/utils";

import { CompetenciesPersonAvatar } from "./CompetenciesPersonAvatar";

import type { CompetencySubjectModel } from "../hooks/competencies-hook-models.types";

type CompetencySubjectHeaderProps = Pick<
  CompetencySubjectModel,
  | "assessment"
  | "personName"
  | "profilePictureUrl"
  | "profileName"
  | "summaryMessage"
  | "headerAction"
>;

export function CompetencySubjectHeader({
  assessment,
  personName,
  profilePictureUrl,
  profileName,
  summaryMessage,
  headerAction,
}: CompetencySubjectHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <CompetenciesPersonAvatar
        name={personName}
        profilePictureUrl={profilePictureUrl}
        className="size-12"
      />
      <div className="min-w-0 flex-1">
        <h2 className="h6 text-neutral-950">{personName}</h2>
        <p className="body-sm mt-0.5 text-neutral-800">
          {profileName && <span className="body-sm-md text-neutral-950">{profileName} · </span>}
          {summaryMessage}
        </p>
      </div>
      {headerAction && <div className="w-full sm:w-64">{headerAction}</div>}
      {assessment && assessment.coverage !== null && (
        <div className="flex w-full flex-col gap-2 sm:w-48">
          <span className="body-sm-md text-neutral-950">
            {t("competencies.requirementsMet", {
              met: assessment.metCount,
              total: assessment.requirementCount,
            })}
          </span>
          <Progress
            value={
              assessment.requirementCount
                ? (assessment.metCount / assessment.requirementCount) * 100
                : 0
            }
            aria-label={t("competencies.overview.readiness")}
            className="h-1.5 bg-neutral-100"
            indicatorClassName={cn({
              "bg-success-500": assessment.metCount === assessment.requirementCount,
              "bg-primary-700": assessment.metCount < assessment.requirementCount,
            })}
          />
        </div>
      )}
    </div>
  );
}
