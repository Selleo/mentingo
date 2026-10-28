import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { useExecuteCompetenciesCommand } from "~/api/mutations/useExecuteCompetenciesCommand";

import { COMPETENCIES_SETUP_STEPS } from "../utils/competenciesReadiness.utils";

import { useCompetenciesOverviewData } from "./useCompetenciesOverviewData";
import { useCompetenciesOverviewFilters } from "./useCompetenciesOverviewFilters";

import type { CompetenciesOverviewOptions } from "./competencies-hooks.types";
import type { CompetenciesSetupStep } from "../utils/competenciesReadiness.utils";

export function useCompetenciesOverview({
  summary,
  canManage,
  onPersonOpen,
  onSetupStepStart,
}: CompetenciesOverviewOptions) {
  const { t } = useTranslation();
  const { mutateAsync: execute, isPending } = useExecuteCompetenciesCommand();
  const peopleSectionRef = useRef<HTMLDivElement>(null);
  const { query, showAssignments, ...filters } = useCompetenciesOverviewFilters();
  const data = useCompetenciesOverviewData({ ...query, canManage });

  const startSetupStep = (step: CompetenciesSetupStep) => {
    if (step !== COMPETENCIES_SETUP_STEPS.ASSIGNMENTS) return onSetupStepStart(step);
    showAssignments();
    peopleSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    peopleSectionRef.current?.querySelector<HTMLElement>("[role=combobox]")?.focus();
  };

  return {
    ...filters,
    ...data,
    t,
    execute,
    isPending,
    peopleSectionRef,
    startSetupStep,
    summary,
    canManage,
    onPersonOpen,
  };
}
