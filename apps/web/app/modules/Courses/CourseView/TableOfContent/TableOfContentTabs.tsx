import { Edit2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export type TableOfContentTab = "toc" | "statistics";

type TableOfContentTabsProps = {
  activeTab: TableOfContentTab;
  onEditContent: () => void;
  onTabChange: (tab: TableOfContentTab) => void;
};

export default function TableOfContentTabs({
  activeTab,
  onEditContent,
  onTabChange,
}: TableOfContentTabsProps) {
  const { t } = useTranslation();

  return (
    <div className="mb-4 flex flex-col items-start justify-between gap-3 border-b border-neutral-200 sm:flex-row sm:items-center md:mb-6">
      <div className="flex w-full items-center gap-4 overflow-x-auto sm:w-auto md:gap-6">
        <button
          type="button"
          onClick={() => onTabChange("toc")}
          className={cn(
            "relative whitespace-nowrap px-1 pb-3 text-sm font-semibold transition-colors",
            activeTab === "toc" ? "text-primary-700" : "text-neutral-800 hover:text-neutral-950",
          )}
        >
          {t("modernCourseView.contents.title")}
          {activeTab === "toc" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-700" />
          )}
        </button>
        <button
          type="button"
          onClick={() => onTabChange("statistics")}
          className={cn(
            "relative whitespace-nowrap px-1 pb-3 text-sm font-semibold transition-colors",
            activeTab === "statistics"
              ? "text-primary-700"
              : "text-neutral-800 hover:text-neutral-950",
          )}
        >
          {t("modernCourseView.contents.statistics")}
          {activeTab === "statistics" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-700" />
          )}
        </button>
      </div>
      <Button variant="primary" onClick={onEditContent} className="mb-3 flex items-center gap-2 ">
        <Edit2 className="size-4" />
        <span className="text-sm font-semibold">{t("modernCourseView.contents.edit")}</span>
      </Button>
    </div>
  );
}
