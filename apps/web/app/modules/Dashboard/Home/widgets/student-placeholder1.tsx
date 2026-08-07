import { DASHBOARD_WIDGET_IDS } from "@repo/shared";
import { useTranslation } from "react-i18next";

import {
  DashboardWidgetCard,
  DashboardWidgetContent,
  DashboardWidgetFooter,
  DashboardWidgetHeader,
} from "../components/WidgetCard";
import { DASHBOARD_WIDGET_REGISTRY } from "../widgetRegistry";

export function WidgetStudentPlaceholder1() {
  const { t } = useTranslation();
  const metadata = DASHBOARD_WIDGET_REGISTRY[DASHBOARD_WIDGET_IDS.STUDENT_PLACEHOLDER1];

  return (
    <DashboardWidgetCard>
      <DashboardWidgetHeader title={t(metadata.titleKey)} icon={metadata.icon} />
      <DashboardWidgetContent className="text-neutral-600">
        {t("dashboardHome.widgets.placeholderContent")}
      </DashboardWidgetContent>
      <DashboardWidgetFooter>{t("dashboardHome.widgets.placeholderFooter")}</DashboardWidgetFooter>
    </DashboardWidgetCard>
  );
}
