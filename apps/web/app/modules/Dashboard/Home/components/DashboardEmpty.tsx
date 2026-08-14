import { LayoutDashboard } from "lucide-react";
import { useTranslation } from "react-i18next";

type DashboardEmptyProps = {
  isEditing: boolean;
};

export function DashboardEmpty({ isEditing }: DashboardEmptyProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-primary-50">
        <LayoutDashboard className="size-6 text-primary-700" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-neutral-950">
        {t("dashboardHome.empty.title")}
      </h2>
      <p className="mt-1 max-w-md text-sm leading-6 text-neutral-600">
        {t(isEditing ? "dashboardHome.empty.editDescription" : "dashboardHome.empty.description")}
      </p>
    </div>
  );
}
