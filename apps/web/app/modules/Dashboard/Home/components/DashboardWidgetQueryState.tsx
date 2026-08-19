import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import Loader from "~/modules/common/Loader/Loader";

type DashboardWidgetQueryStateProps = {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  className?: string;
};

export function DashboardWidgetQueryState({
  isLoading,
  isError,
  onRetry,
  className,
}: DashboardWidgetQueryStateProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className={cn("flex size-full items-center justify-center", className)}>
        <Loader />
      </div>
    );
  }

  if (!isError) return null;

  return (
    <div className={cn("flex size-full flex-col items-center justify-center gap-3", className)}>
      <p className="text-neutral-600 text-center">{t("dashboardHome.widgets.loadError")}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        {t("dashboardHome.error.retry")}
      </Button>
    </div>
  );
}
