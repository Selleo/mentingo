import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Input } from "~/components/ui/input";

import { LEARNING_PATHS_PAGE_HANDLES } from "../../../../e2e/data/learning-paths/handles";

type LearningPathsPageHeaderProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
};

export function LearningPathsPageHeader({
  searchValue,
  onSearchChange,
}: LearningPathsPageHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex flex-col lg:p-0">
        <h4 className="h4 pb-1 text-neutral-950" data-testid={LEARNING_PATHS_PAGE_HANDLES.HEADING}>
          {t("learningPathsView.title")}
        </h4>
        <p className="body-lg-md text-neutral-800">{t("learningPathsView.description")}</p>
      </div>

      <div className="relative w-full lg:max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
        <Input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t("learningPathsView.searchPlaceholder")}
          className="h-10 pl-9 text-sm"
        />
      </div>
    </div>
  );
}
