import { useTranslation } from "react-i18next";

import { useToggleCohortLearning } from "~/api/mutations/admin/useToggleCohortLearning";
import { useToggleModernCourseList } from "~/api/mutations/admin/useToggleModernCourseList";
import { useUnregisteredUserCoursesAccessibility } from "~/api/mutations/admin/useUnregisteredUserCoursesAccessibility";

import { SettingItem } from "../SettingItem";

import type { GlobalSettings } from "../../types";

interface CoursesAccessibilityPreferencesProps {
  globalSettings: GlobalSettings;
}

export default function CoursesAccessibilityPreferences({
  globalSettings,
}: CoursesAccessibilityPreferencesProps) {
  const { t } = useTranslation();

  const { mutate: changeUnregisteredUserCoursesAccessibility } =
    useUnregisteredUserCoursesAccessibility();
  const { mutate: toggleModernCourseList } = useToggleModernCourseList();
  const { mutate: toggleCohortLearning } = useToggleCohortLearning();

  const handleCoursesAccessibilityChange = () => {
    changeUnregisteredUserCoursesAccessibility();
  };

  return (
    <div className="space-y-4">
      <SettingItem
        id="coursesVisibility"
        label={t("adminPreferences.field.coursesVisibility")}
        description={t("adminPreferences.field.coursesVisibilityDescription")}
        checked={globalSettings.unregisteredUserCoursesAccessibility}
        onCheckedChange={handleCoursesAccessibilityChange}
      />
      <SettingItem
        id="modernCourseList"
        label={t("adminPreferences.field.modernCourseList")}
        description={t("adminPreferences.field.modernCourseListDescription")}
        checked={globalSettings.modernCourseListEnabled}
        onCheckedChange={toggleModernCourseList}
      />
      <SettingItem
        id="cohortLearning"
        label={t("adminPreferences.field.cohortLearning")}
        description={t("adminPreferences.field.cohortLearningDescription")}
        checked={globalSettings.cohortLearningEnabled}
        onCheckedChange={toggleCohortLearning}
      />
    </div>
  );
}
