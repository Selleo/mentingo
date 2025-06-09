import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useUserRole } from "~/hooks/useUserRole";

export const useEditCourseTabs = () => {
  const { t } = useTranslation();

  const { isAdmin } = useUserRole();

  const baseTabs = useMemo(
    () => [
      { label: t("adminCourseView.common.settings"), value: "Settings" },
      { label: t("adminCourseView.common.curriculum"), value: "Curriculum" },
      { label: t("adminCourseView.common.pricing"), value: "Pricing" },
      { label: t("adminCourseView.common.status"), value: "Status" },
    ],
    [t],
  );

  const adminTabs = useMemo(
    () => [{ label: t("adminCourseView.common.enrolledStudents"), value: "Enrolled" }],
    [t],
  );

  return isAdmin ? [...baseTabs, ...adminTabs] : baseTabs;
};
