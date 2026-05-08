import { useTranslation } from "react-i18next";

import { useToggleModernCourseList } from "~/api/mutations/admin/useToggleModernCourseList";
import { useUnregisteredUserCoursesAccessibility } from "~/api/mutations/admin/useUnregisteredUserCoursesAccessibility";

import { SETTINGS_PAGE_HANDLES } from "../../../../../../e2e/data/settings/handles";
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
        testId={SETTINGS_PAGE_HANDLES.COURSES_VISIBILITY_SWITCH}
      />
      <SettingItem
        id="modernCourseList"
        label={t("adminPreferences.field.modernCourseList")}
        description={t("adminPreferences.field.modernCourseListDescription")}
        checked={globalSettings.modernCourseListEnabled}
        onCheckedChange={toggleModernCourseList}
        testId={SETTINGS_PAGE_HANDLES.MODERN_COURSE_LIST_SWITCH}
      />
    </div>
  );
}
