import { Edit2 } from "lucide-react";
import { useTranslation } from "react-i18next";

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
    <div className="mb-4 flex flex-col items-start justify-between gap-3 border-b border-[#e5e5e5] sm:flex-row sm:items-center md:mb-6">
      <div className="flex w-full items-center gap-4 overflow-x-auto sm:w-auto md:gap-6">
        <button
          type="button"
          onClick={() => onTabChange("toc")}
          className={cn(
            "relative whitespace-nowrap px-1 pb-3 text-sm font-semibold transition-colors",
            activeTab === "toc" ? "text-[#3f58b6]" : "text-[#676767] hover:text-[#363636]",
          )}
        >
          {t("modernCourseView.contents.title")}
          {activeTab === "toc" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3f58b6]" />
          )}
        </button>
        <button
          type="button"
          onClick={() => onTabChange("statistics")}
          className={cn(
            "relative whitespace-nowrap px-1 pb-3 text-sm font-semibold transition-colors",
            activeTab === "statistics" ? "text-[#3f58b6]" : "text-[#676767] hover:text-[#363636]",
          )}
        >
          {t("modernCourseView.contents.statistics")}
          {activeTab === "statistics" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3f58b6]" />
          )}
        </button>
      </div>
      <button
        type="button"
        onClick={onEditContent}
        className="mb-3 flex items-center gap-2 whitespace-nowrap rounded-lg bg-[#3f58b6] px-3 py-2 text-white transition-colors hover:bg-[#324a95] md:px-4"
      >
        <Edit2 className="h-4 w-4" />
        <span className="text-sm font-semibold">{t("modernCourseView.contents.edit")}</span>
      </button>
    </div>
  );
}
