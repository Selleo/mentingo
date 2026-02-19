import { useTranslation } from "react-i18next";

import ErrorPage from "~/components/ErrorPage/ErrorPage";

export default function TenantInactivePage() {
  const { t } = useTranslation();

  return (
    <ErrorPage
      title={t("tenantInactive.title")}
      description={t("tenantInactive.description")}
      showAction={false}
    />
  );
}
