import {
  ClipboardCheck,
  LayoutDashboard,
  Settings2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { match } from "ts-pattern";

import { COMPETENCIES_HANDLES } from "../../../../e2e/data/competencies/handles";

import type { CompetenciesSummary } from "../competencies.types";
import type { TFunction } from "i18next";

export type Capabilities = { canManage: boolean; canPlan: boolean };

export const WORKSPACE_TABS = {
  OVERVIEW: "overview",
  OWN: "own",
  REVIEW: "review",
  SETUP: "setup",
} as const;

export type WorkspaceTab = (typeof WORKSPACE_TABS)[keyof typeof WORKSPACE_TABS];

export const WORKSPACE_SEARCH_PARAMS = {
  TAB: "tab",
  PERSON: "person",
  SECTION: "section",
} as const;

export type WorkspaceSearchParam =
  (typeof WORKSPACE_SEARCH_PARAMS)[keyof typeof WORKSPACE_SEARCH_PARAMS];

export const tabClassName =
  "gap-2 rounded-none border-b-2 border-transparent px-0 py-3 font-medium text-neutral-800 data-[state=active]:border-primary-700 data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-primary-800 data-[state=active]:shadow-none";

export function getDefaultWorkspaceTab(capabilities: Capabilities): WorkspaceTab {
  if (capabilities.canManage || capabilities.canPlan) return WORKSPACE_TABS.OVERVIEW;
  return WORKSPACE_TABS.OWN;
}

export function parseWorkspaceTab(value: string | null, capabilities: Capabilities): WorkspaceTab {
  const canSeeTeam = capabilities.canManage || capabilities.canPlan;
  return match(value)
    .with(WORKSPACE_TABS.OVERVIEW, (tab) => (canSeeTeam ? tab : WORKSPACE_TABS.OWN))
    .with(WORKSPACE_TABS.OWN, (tab) => (canSeeTeam ? WORKSPACE_TABS.OVERVIEW : tab))
    .with(WORKSPACE_TABS.SETUP, (tab) =>
      capabilities.canManage ? tab : getDefaultWorkspaceTab(capabilities),
    )
    .with(WORKSPACE_TABS.REVIEW, (tab) => tab)
    .otherwise(() => getDefaultWorkspaceTab(capabilities));
}

export function getWorkspacePresentation(
  capabilities: Capabilities,
  summary: CompetenciesSummary,
  tab: WorkspaceTab,
  t: TFunction,
) {
  const canSeeTeam = capabilities.canManage || capabilities.canPlan;
  const tabs: {
    value: WorkspaceTab;
    label: string;
    icon: LucideIcon;
    testId: string;
    count?: number;
  }[] = [
    ...(canSeeTeam
      ? [
          {
            value: WORKSPACE_TABS.OVERVIEW,
            label: t(
              capabilities.canManage ? "competencies.tabs.overview" : "competencies.tabs.team",
            ),
            icon: LayoutDashboard,
            testId: COMPETENCIES_HANDLES.OVERVIEW,
          },
        ]
      : [
          {
            value: WORKSPACE_TABS.OWN,
            label: t("competencies.own"),
            icon: UserRound,
            testId: COMPETENCIES_HANDLES.OWN,
          },
        ]),
    ...(summary.isVerifier
      ? [
          {
            value: WORKSPACE_TABS.REVIEW,
            label: t("competencies.tabs.approvals"),
            icon: ClipboardCheck,
            testId: COMPETENCIES_HANDLES.REVIEW,
            count: summary.pendingReviewCount,
          },
        ]
      : []),
    ...(capabilities.canManage
      ? [
          {
            value: WORKSPACE_TABS.SETUP,
            label: t("competencies.tabs.setup"),
            icon: Settings2,
            testId: COMPETENCIES_HANDLES.SETUP,
          },
        ]
      : []),
  ];
  const activeTabLabel = tabs.find((item) => item.value === tab)?.label ?? t("competencies.title");
  const pageDescription = match(tab)
    .with(WORKSPACE_TABS.OVERVIEW, () =>
      t(
        capabilities.canManage
          ? "competencies.descriptionByView.overview"
          : "competencies.descriptionByView.team",
      ),
    )
    .with(WORKSPACE_TABS.OWN, () => t("competencies.descriptionByView.ownWithoutProfile"))
    .with(WORKSPACE_TABS.REVIEW, () => t("competencies.descriptionByView.review"))
    .with(WORKSPACE_TABS.SETUP, () => t("competencies.descriptionByView.setup"))
    .exhaustive();

  return { tabs, activeTabLabel, pageDescription };
}
