import { useSearchParams } from "@remix-run/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useCompetenciesSummary } from "~/api/queries/useCompetenciesSummary";
import { useCurrentUser } from "~/api/queries/useCurrentUser";

import { COMPETENCIES_SETUP_STEPS } from "../utils/competenciesReadiness.utils";
import { SETUP_SECTIONS, parseSetupSection } from "../utils/competenciesSetup.utils";
import {
  WORKSPACE_SEARCH_PARAMS,
  WORKSPACE_TABS,
  parseWorkspaceTab,
} from "../utils/competenciesWorkspace.utils";

import type { CompetenciesWorkspaceOptions } from "./competencies-hooks.types";
import type { CompetencyCatalogItem, CompetencyProfileItem } from "../competencies.types";
import type { CompetenciesSetupStep } from "../utils/competenciesReadiness.utils";
import type { WorkspaceSearchParam, WorkspaceTab } from "../utils/competenciesWorkspace.utils";

export function useCompetenciesWorkspace({ capabilities }: CompetenciesWorkspaceOptions) {
  const { t } = useTranslation();
  const { data: user } = useCurrentUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseWorkspaceTab(searchParams.get(WORKSPACE_SEARCH_PARAMS.TAB), capabilities);
  const personId = searchParams.get(WORKSPACE_SEARCH_PARAMS.PERSON);
  const setupSection = parseSetupSection(searchParams.get(WORKSPACE_SEARCH_PARAMS.SECTION));
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [catalogEditor, setCatalogEditor] = useState<{ value?: CompetencyCatalogItem } | null>(
    null,
  );
  const [profileEditor, setProfileEditor] = useState<{ profile?: CompetencyProfileItem } | null>(
    null,
  );
  const { data: summary, isPending, isError, refetch } = useCompetenciesSummary();
  const userId = user?.id ?? "";
  const canSeeTeam = capabilities.canManage || capabilities.canPlan;

  const updateSearchParams = (changes: Partial<Record<WorkspaceSearchParam, string | null>>) =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { preventScrollReset: true },
    );
  const openTab = (value: WorkspaceTab, section: string | null = null) =>
    updateSearchParams({
      [WORKSPACE_SEARCH_PARAMS.TAB]: value,
      [WORKSPACE_SEARCH_PARAMS.PERSON]: null,
      [WORKSPACE_SEARCH_PARAMS.SECTION]: section,
    });
  const openPerson = (id: string) => {
    if (id === userId && !canSeeTeam) return openTab(WORKSPACE_TABS.OWN);
    updateSearchParams({ [WORKSPACE_SEARCH_PARAMS.PERSON]: id });
  };
  const closePerson = () => updateSearchParams({ [WORKSPACE_SEARCH_PARAMS.PERSON]: null });
  const startSetupStep = (step: CompetenciesSetupStep) =>
    match(step)
      .with(COMPETENCIES_SETUP_STEPS.CATEGORIES, () => {
        openTab(WORKSPACE_TABS.SETUP, SETUP_SECTIONS.CATEGORIES);
        setCategoryEditorOpen(true);
      })
      .with(COMPETENCIES_SETUP_STEPS.COMPETENCIES, () => {
        openTab(WORKSPACE_TABS.SETUP, SETUP_SECTIONS.COMPETENCIES);
        setCatalogEditor({});
      })
      .with(COMPETENCIES_SETUP_STEPS.PROFILES, () => {
        openTab(WORKSPACE_TABS.SETUP, SETUP_SECTIONS.PROFILES);
        setProfileEditor({});
      })
      .with(COMPETENCIES_SETUP_STEPS.ASSIGNMENTS, () => openTab(WORKSPACE_TABS.OVERVIEW))
      .exhaustive();

  return {
    t,
    user,
    tab,
    personId,
    setupSection,
    categoryEditorOpen,
    setCategoryEditorOpen,
    catalogEditor,
    setCatalogEditor,
    profileEditor,
    setProfileEditor,
    summary,
    isPending,
    isError,
    refetch,
    userId,
    canSeeTeam,
    updateSearchParams,
    openTab,
    openPerson,
    closePerson,
    startSetupStep,
    capabilities,
  };
}
