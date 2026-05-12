import { Plus, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

import { LEARNING_PATHS_PAGE_HANDLES } from "../../../../../e2e/data/learning-paths/handles";
import { useAdminLearningPathsPageContext } from "../context/AdminLearningPathsPageContext";

export function AdminLearningPathsHeader() {
  const { t } = useTranslation();
  const { searchValue, setSearchValue, totalPaths, canCreateLearningPaths, openCreateCard } =
    useAdminLearningPathsPageContext();

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex flex-col lg:p-0">
        <h4 className="h4 pb-1 text-neutral-950" data-testid={LEARNING_PATHS_PAGE_HANDLES.HEADING}>
          {t("adminLearningPathsView.title")}
        </h4>
        <p className="body-lg-md text-neutral-800">{t("adminLearningPathsView.description")}</p>
        <p className="details-md mt-1 text-neutral-600">
          {t("adminLearningPathsView.summary", { count: totalPaths })}
        </p>
      </div>

      <div className="flex shrink-0 gap-3">
        <div className="relative w-full lg:w-80">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder={t("learningPathsView.searchPlaceholder")}
            className="h-10 pl-9 text-sm"
          />
        </div>
        {canCreateLearningPaths && (
          <Button type="button" variant="primary" className="gap-2" onClick={openCreateCard}>
            <Plus className="size-4" />
            {t("adminLearningPathsView.buttons.create")}
          </Button>
        )}
      </div>
    </div>
  );
}
