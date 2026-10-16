import { MASTER_COURSE_EXPORT_SYNC_STATUSES } from "@repo/shared";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Badge } from "~/components/ui/badge";

import type { SharingTenant } from "./tenantSharing.types";

type TenantSharingStatusBadgeProps = {
  tenant: SharingTenant;
};

export function TenantSharingStatusBadge({ tenant }: TenantSharingStatusBadgeProps) {
  const { t } = useTranslation();

  if (tenant.isExported) {
    return <Badge variant="success">{t("tenantSharing.status.shared")}</Badge>;
  }

  return match(tenant.syncStatus)
    .with(
      MASTER_COURSE_EXPORT_SYNC_STATUSES.PENDING,
      MASTER_COURSE_EXPORT_SYNC_STATUSES.PROCESSING,
      () => <Badge variant="inProgress">{t("tenantSharing.status.inProgress")}</Badge>,
    )
    .with(MASTER_COURSE_EXPORT_SYNC_STATUSES.PAUSED, () => (
      <Badge variant="notStarted">{t("tenantSharing.status.paused")}</Badge>
    ))
    .with(MASTER_COURSE_EXPORT_SYNC_STATUSES.FAILED, () => (
      <Badge className="border border-error-200 bg-error-50 text-error-700">
        {t("tenantSharing.status.failed")}
      </Badge>
    ))
    .otherwise(() => null);
}
