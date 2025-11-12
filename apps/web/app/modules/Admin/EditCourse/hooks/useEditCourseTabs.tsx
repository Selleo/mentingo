import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useStripeConfigured } from "~/api/queries/useStripeConfigured";
import { useUserRole } from "~/hooks/useUserRole";

export const useEditCourseTabs = () => {
  const { t } = useTranslation();
  const { data: isStripeConfigured } = useStripeConfigured();

  const { isAdmin } = useUserRole();

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
    () => [{ label: t("adminCourseView.common.enrolledStudents"), value: "Enrolled" }],
    [t],
  );

  return isAdmin ? [...baseTabs, ...adminTabs] : baseTabs;
};
