import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

/** Shown inside search pickers while results are loading from the API. */
export function DirectorySyncSearchLoading() {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center gap-2 py-3 text-sm text-neutral-600">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      {t("common.button.loading")}
    </div>
  );
}
