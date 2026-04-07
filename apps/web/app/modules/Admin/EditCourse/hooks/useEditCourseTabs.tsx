import { PERMISSIONS } from "@repo/shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUserSuspense } from "~/api/queries";
import { useStripeConfigured } from "~/api/queries/useStripeConfigured";
import { usePermissions } from "~/hooks/usePermissions";

import { EDIT_COURSE_TABS } from "../EditCourse.types";

export const useEditCourseTabs = () => {
  const { t } = useTranslation();
  const { data: isStripeConfigured } = useStripeConfigured();

  const { hasAccess: canManageUsers } = usePermissions({ required: PERMISSIONS.USER_MANAGE });
  const { data: currentUser } = useCurrentUserSuspense();
  const isManagingTenantAdmin = Boolean(currentUser?.isManagingTenantAdmin);

  const baseTabs = useMemo(
    () => [
      { label: t("adminCourseView.common.settings"), value: EDIT_COURSE_TABS.SETTINGS },
      { label: t("adminCourseView.common.curriculum"), value: EDIT_COURSE_TABS.CURRICULUM },
      ...(isStripeConfigured?.enabled
        ? [
            {
              label: t("adminCourseView.common.pricing"),
              value: EDIT_COURSE_TABS.PRICING,
            },
          ]
        : []),
      { label: t("adminCourseView.common.status"), value: EDIT_COURSE_TABS.STATUS },
    ],
    [isStripeConfigured, t],
  );

  const adminTabs = useMemo(
    () => [
      { label: t("adminCourseView.common.enrolledStudents"), value: EDIT_COURSE_TABS.ENROLLED },
      ...(isManagingTenantAdmin
        ? [
            {
              label: t("adminCourseView.sharedCourse.exportsTitle"),
              value: EDIT_COURSE_TABS.EXPORTS,
            },
          ]
        : []),
    ],
    [isManagingTenantAdmin, t],
  );

  return canManageUsers ? [...baseTabs, ...adminTabs] : baseTabs;
};
