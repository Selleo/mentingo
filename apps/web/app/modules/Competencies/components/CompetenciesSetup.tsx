import { BellRing, BriefcaseBusiness, Tags, Milestone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Progress } from "~/components/ui/progress";
import { cn } from "~/lib/utils";

import { COMPETENCIES_HANDLES } from "../../../../e2e/data/competencies/handles";
import { useCompetenciesSetupProgress } from "../hooks/useCompetenciesSetupProgress";
import { COMPETENCIES_SETUP_STEPS } from "../utils/competenciesReadiness.utils";
import { SETUP_SECTIONS } from "../utils/competenciesSetup.utils";

import { CompetenciesCatalog } from "./CompetenciesCatalog";
import { CompetenciesCategories } from "./CompetenciesCategories";
import { CompetenciesProfiles } from "./CompetenciesProfiles";
import { CompetenciesSettings } from "./CompetenciesSettings";
import { CompetenciesSetupPanel } from "./CompetenciesSetupPanel";

import type {
  CompetenciesSummary,
  CompetencyCatalogItem,
  CompetencyProfileItem,
} from "../competencies.types";
import type { SetupSection } from "../utils/competenciesSetup.utils";
import type { LucideIcon } from "lucide-react";

export function CompetenciesSetup({
  summary,
  section,
  onSectionChange,
  onCompetencyEdit,
  onProfileEdit,
}: {
  summary: CompetenciesSummary;
  section: SetupSection;
  onSectionChange: (section: SetupSection) => void;
  onCompetencyEdit: (value?: CompetencyCatalogItem) => void;
  onProfileEdit: (profile?: CompetencyProfileItem) => void;
}) {
  const { t } = useTranslation();
  const { categoryCount, progress } = useCompetenciesSetupProgress(summary);
  const canCreateProfile = progress[COMPETENCIES_SETUP_STEPS.COMPETENCIES];
  const { warningDays } = summary;
  const completedSteps = Object.values(progress).filter(Boolean).length;
  const totalSteps = Object.values(progress).length;
  const navigation: {
    value: SetupSection;
    label: string;
    detail: string;
    icon: LucideIcon;
    meta?: string;
  }[] = [
    {
      value: SETUP_SECTIONS.CATEGORIES,
      label: t("competencies.categories.title"),
      detail: match(categoryCount)
        .with(undefined, () => "")
        .otherwise((count) => t("competencies.categories.nav", { count })),
      icon: Tags,
      meta: categoryCount?.toString(),
    },
    {
      value: SETUP_SECTIONS.COMPETENCIES,
      label: t("competencies.setupSection.competenciesTitle"),
      detail: t("competencies.setupSection.competenciesNav", {
        count: summary.setup.competencies,
      }),
      icon: Milestone,
      meta: String(summary.setup.competencies),
    },
    {
      value: SETUP_SECTIONS.PROFILES,
      label: t("competencies.setupSection.profilesTitle"),
      detail: t("competencies.setupSection.profilesNav", { count: summary.setup.assignments }),
      icon: BriefcaseBusiness,
      meta: String(summary.setup.profiles),
    },
    {
      value: SETUP_SECTIONS.EXPIRY,
      label: t("competencies.setupSection.settingsTitle"),
      detail:
        warningDays === null
          ? t("competencies.setupSection.expiryNavOff")
          : t("competencies.setupSection.expiryNav", { count: warningDays }),
      icon: BellRing,
      meta:
        warningDays === null
          ? t("competencies.setupSection.expiryOff")
          : t("competencies.setupSection.expiryDays", { count: warningDays }),
    },
  ];

  return (
    <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <nav
        aria-label={t("competencies.tabs.setup")}
        className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm lg:sticky lg:top-6"
      >
        {completedSteps < totalSteps && (
          <div className="flex flex-col gap-2 rounded-lg bg-neutral-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="body-sm-md text-neutral-950">
                {t("competencies.setupSection.progressTitle")}
              </span>
              <span className="details-md text-neutral-800">
                {completedSteps}/{totalSteps}
              </span>
            </div>
            <Progress
              value={(completedSteps / totalSteps) * 100}
              aria-label={t("competencies.setupSection.progressTitle")}
              className="h-1.5 bg-neutral-200"
              indicatorClassName={cn({
                "bg-success-500": completedSteps === totalSteps,
                "bg-primary-700": completedSteps < totalSteps,
              })}
            />
          </div>
        )}
        <div className="flex gap-1 overflow-x-auto lg:flex-col">
          {navigation.map((item) => {
            const isActive = item.value === section;
            return (
              <button
                key={item.value}
                type="button"
                aria-current={isActive ? "page" : undefined}
                data-testid={COMPETENCIES_HANDLES.SETUP_SECTION(item.value)}
                onClick={() => onSectionChange(item.value)}
                className={cn(
                  "flex min-w-56 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors lg:min-w-0",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600",
                  isActive && "border-primary-200 bg-primary-50",
                  !isActive && "border-transparent hover:bg-neutral-50",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    isActive && "bg-white text-primary-700 ring-1 ring-primary-200",
                    !isActive && "bg-neutral-100 text-neutral-800",
                  )}
                >
                  <item.icon className="size-4" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={cn(
                      "body-sm-md truncate",
                      isActive && "text-primary-800",
                      !isActive && "text-neutral-950",
                    )}
                  >
                    {item.label}
                  </span>
                  <span className="details truncate text-neutral-700">{item.detail}</span>
                </span>
                {item.meta && (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 text-xs font-semibold",
                      isActive && "bg-primary-100 text-primary-800",
                      !isActive && "bg-neutral-100 text-neutral-800",
                    )}
                  >
                    {item.meta}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
      <section className="flex min-w-0 flex-col gap-5">
        {match(section)
          .with(SETUP_SECTIONS.COMPETENCIES, () => (
            <CompetenciesSetupPanel
              title={t("competencies.setupSection.competenciesTitle")}
              description={t("competencies.setupSection.competenciesDescription")}
            >
              <CompetenciesCatalog onEdit={onCompetencyEdit} onCreate={() => onCompetencyEdit()} />
            </CompetenciesSetupPanel>
          ))
          .with(SETUP_SECTIONS.CATEGORIES, () => (
            <CompetenciesSetupPanel
              title={t("competencies.categories.title")}
              description={t("competencies.categories.description")}
            >
              <CompetenciesCategories />
            </CompetenciesSetupPanel>
          ))
          .with(SETUP_SECTIONS.PROFILES, () => (
            <CompetenciesSetupPanel
              title={t("competencies.setupSection.profilesTitle")}
              description={t("competencies.setupSection.profilesDescription")}
            >
              <CompetenciesProfiles
                onEdit={onProfileEdit}
                onCreate={canCreateProfile ? () => onProfileEdit() : undefined}
              />
            </CompetenciesSetupPanel>
          ))
          .with(SETUP_SECTIONS.EXPIRY, () => (
            <CompetenciesSetupPanel
              title={t("competencies.setupSection.settingsTitle")}
              description={t("competencies.setupSection.settingsDescription")}
            >
              <CompetenciesSettings currentWarningDays={warningDays} />
            </CompetenciesSetupPanel>
          ))
          .exhaustive()}
      </section>
    </div>
  );
}

export { SETUP_SECTIONS, parseSetupSection } from "../utils/competenciesSetup.utils";
export type { SetupSection } from "../utils/competenciesSetup.utils";
