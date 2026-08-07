import { useTranslation } from "react-i18next";

import {
  DashboardWidgetCard,
  DashboardWidgetContent,
  DashboardWidgetFooter,
  DashboardWidgetHeader,
} from "../components/WidgetCard";
import { DASHBOARD_WIDGET_REGISTRY } from "../widgetRegistry";

export function WidgetAdminPlaceholder2() {
  const { t } = useTranslation();

  return (
    <DashboardWidgetCard>
      <DashboardWidgetHeader
        title={t(DASHBOARD_WIDGET_REGISTRY.a_placeholder_2.titleKey)}
        icon={DASHBOARD_WIDGET_REGISTRY.a_placeholder_2.icon}
      />
      <DashboardWidgetContent>
        {t("dashboardHome.widgets.placeholderContent")}
      </DashboardWidgetContent>
      <DashboardWidgetFooter>{t("dashboardHome.widgets.placeholderFooter")}</DashboardWidgetFooter>
    </DashboardWidgetCard>
  );
}
