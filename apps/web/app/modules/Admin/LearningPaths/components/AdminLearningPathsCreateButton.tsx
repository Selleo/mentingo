import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAdminLearningPathsPageContext } from "../context/AdminLearningPathsPageContext";

export function AdminLearningPathsCreateButton() {
  const { t } = useTranslation();
  const { openCreateCard } = useAdminLearningPathsPageContext();

  return (
    <button
      type="button"
      className="rounded-xl border border-dashed border-primary-200 bg-primary-50/30 py-5 text-center text-sm font-semibold text-primary-700 transition hover:bg-primary-50"
      onClick={openCreateCard}
    >
      <Plus className="mr-2 inline size-4" />
      {t("adminLearningPathsView.buttons.create")}
    </button>
  );
}
