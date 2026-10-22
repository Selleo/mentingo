import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAdminLearningPathsPageContext } from "../context/AdminLearningPathsPageContext";

export function AdminLearningPathsCreateButton() {
  const { t } = useTranslation();
  const { openCreateCard } = useAdminLearningPathsPageContext();

  return (
    <button
      type="button"
      className="flex min-h-[200px] w-full flex-1 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary-200 bg-white p-6 text-center text-sm font-semibold text-primary-700 transition hover:border-primary-400 hover:bg-primary-50"
      onClick={openCreateCard}
    >
      <span className="grid size-12 place-items-center rounded-full bg-primary-50">
        <Plus className="size-5" />
      </span>
      {t("adminLearningPathsView.buttons.create")}
    </button>
  );
}
