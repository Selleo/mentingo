import { CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

type DashboardErrorProps = {
  onRetry: () => void;
};

export function DashboardError({ onRetry }: DashboardErrorProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-error-200 bg-error-50 px-6 text-center">
      <CircleAlert className="size-8 text-error-700" aria-hidden="true" />
      <h2 className="mt-3 text-lg font-semibold text-neutral-950">
        {t("dashboardHome.error.title")}
      </h2>
      <p className="mt-1 max-w-md text-sm text-neutral-700">
        {t("dashboardHome.error.description")}
      </p>
      <Button type="button" variant="outline" className="mt-4" onClick={onRetry}>
        {t("dashboardHome.error.retry")}
      </Button>
    </div>
  );
}
