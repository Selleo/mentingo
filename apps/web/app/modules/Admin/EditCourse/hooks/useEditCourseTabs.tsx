import { PERMISSIONS } from "@repo/shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUserSuspense } from "~/api/queries";
import { useStripeConfigured } from "~/api/queries/useStripeConfigured";
import { usePermissions } from "~/hooks/usePermissions";

export const useEditCourseTabs = () => {
  const { t } = useTranslation();
  const { data: isStripeConfigured } = useStripeConfigured();

  const { hasAccess: canManageUsers } = usePermissions({ required: PERMISSIONS.USER_MANAGE });
  const { data: currentUser } = useCurrentUserSuspense();
  const isManagingTenantAdmin = Boolean(currentUser?.isManagingTenantAdmin);

  const baseTabs = useMemo(
    () => [
      { label: t("adminCourseView.common.settings"), value: "Settings" },
      { label: t("adminCourseView.common.curriculum"), value: "Curriculum" },
      ...(isStripeConfigured?.enabled
        ? [
            {
              label: t("adminCourseView.common.pricing"),
              value: "Pricing",
            },
          ]
        : []),
      { label: t("adminCourseView.common.status"), value: "Status" },
    ],
    [isStripeConfigured, t],
  );

  const adminTabs = useMemo(
    () => [
      { label: t("adminCourseView.common.enrolledStudents"), value: "Enrolled" },
      ...(isManagingTenantAdmin
        ? [{ label: t("adminCourseView.sharedCourse.exportsTitle"), value: "Exports" }]
        : []),
    ],
    [isManagingTenantAdmin, t],
  );

  return canManageUsers ? [...baseTabs, ...adminTabs] : baseTabs;
};
