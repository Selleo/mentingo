import {
  COURSE_FEATURE,
  COURSE_TYPE,
  PERMISSIONS,
  isCourseFeatureEnabledForCourseType,
} from "@repo/shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUserSuspense } from "~/api/queries";
import { useStripeConfigured } from "~/api/queries/useStripeConfigured";
import { usePermissions } from "~/hooks/usePermissions";

import { EDIT_COURSE_TABS } from "../EditCourse.types";

import type { CourseType } from "@repo/shared";

type UseEditCourseTabsParams = {
  courseType?: CourseType;
};

export const useEditCourseTabs = ({
  courseType = COURSE_TYPE.DEFAULT,
}: UseEditCourseTabsParams = {}) => {
  const { t } = useTranslation();
  const { data: isStripeConfigured } = useStripeConfigured();

  const { hasAccess: canManageUsers } = usePermissions({ required: PERMISSIONS.USER_MANAGE });
  const { hasAccess: canManageCourses } = usePermissions({
    required: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
  });
  const { data: currentUser } = useCurrentUserSuspense();
  const canShowTenantSharing = Boolean(
    currentUser?.isManagingTenantAdmin && !currentUser?.isSupportMode,
  );

  const baseTabs = useMemo(() => {
    const canEditCurriculum = isCourseFeatureEnabledForCourseType(
      courseType,
      COURSE_FEATURE.CURRICULUM_EDITING,
    );

    return [
      { label: t("adminCourseView.common.settings"), value: EDIT_COURSE_TABS.SETTINGS },
      ...(canEditCurriculum
        ? [{ label: t("adminCourseView.common.curriculum"), value: EDIT_COURSE_TABS.CURRICULUM }]
        : []),
      ...(isStripeConfigured?.enabled
        ? [
            {
              label: t("adminCourseView.common.pricing"),
              value: EDIT_COURSE_TABS.PRICING,
            },
          ]
        : []),
      { label: t("adminCourseView.common.status"), value: EDIT_COURSE_TABS.STATUS },
    ];
  }, [courseType, isStripeConfigured, t]);

  const adminTabs = useMemo(
    () => [
      { label: t("adminCourseView.common.enrolledStudents"), value: EDIT_COURSE_TABS.ENROLLED },
    ],
    [t],
  );

  const exportTabs = useMemo(
    () =>
      canManageCourses || canShowTenantSharing
        ? [
            {
              label: t("adminCourseView.sharedCourse.exportsTitle"),
              value: EDIT_COURSE_TABS.EXPORTS,
            },
          ]
        : [],
    [canManageCourses, canShowTenantSharing, t],
  );

  return [...baseTabs, ...(canManageUsers ? adminTabs : []), ...exportTabs];
};
