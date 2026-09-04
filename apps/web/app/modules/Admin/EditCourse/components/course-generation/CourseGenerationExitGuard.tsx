import { useTranslation } from "react-i18next";

import { UnsavedChangesExitGuard } from "~/modules/Admin/components/UnsavedChangesExitGuard";

type CourseGenerationExitGuardProps = {
  enabled: boolean;
};

export function CourseGenerationExitGuard({ enabled }: CourseGenerationExitGuardProps) {
  const { t } = useTranslation();

  return (
    <UnsavedChangesExitGuard
      enabled={enabled}
      dialogTitle={t("adminCourseView.generation.exitDialogTitle")}
      message={t("adminCourseView.generation.exitWarning")}
      leaveLabel={t("common.button.proceed")}
    />
  );
}
