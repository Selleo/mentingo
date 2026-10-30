import { useTranslation } from "react-i18next";

import { TabsList, TabsTrigger } from "~/components/ui/tabs";

import { tabClassName } from "../utils/competenciesWorkspace.utils";

import type { WorkspaceTab } from "../utils/competenciesWorkspace.utils";
import type { LucideIcon } from "lucide-react";

type CompetenciesWorkspaceTabsProps = {
  tabs: { value: WorkspaceTab; label: string; icon: LucideIcon; testId: string; count?: number }[];
};

export function CompetenciesWorkspaceTabs({ tabs }: CompetenciesWorkspaceTabsProps) {
  const { t } = useTranslation();
  return (
    <div className="mb-6 overflow-x-auto border-b border-neutral-200">
      <TabsList
        aria-label={t("competencies.title")}
        className="h-auto min-w-max justify-start gap-6 rounded-none bg-transparent p-0"
      >
        {tabs.map((item) => (
          <TabsTrigger
            key={item.value}
            className={tabClassName}
            value={item.value}
            data-testid={item.testId}
          >
            <item.icon className="size-4 shrink-0" aria-hidden="true" />
            {item.label}
            {Boolean(item.count) && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-warning-400 px-1.5 text-xs font-semibold text-neutral-950">
                {item.count}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  );
}
