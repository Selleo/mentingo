import { useTranslation } from "react-i18next";

import { useToggleLiveTraining } from "~/api/mutations/admin/useToggleLiveTraining";
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
  const { mutate: toggleLiveTraining } = useToggleLiveTraining();
  const trainerRoleUserCount = globalSettings.trainerRoleUserCount ?? 0;
  const isLiveTrainingDisableBlocked =
    globalSettings.liveTrainingEnabled && trainerRoleUserCount > 0;

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
      <SettingItem
        id="liveTraining"
        label={t("adminPreferences.field.liveTraining")}
        description={t("adminPreferences.field.liveTrainingDescription")}
        checked={globalSettings.liveTrainingEnabled}
        onCheckedChange={toggleLiveTraining}
        disabled={isLiveTrainingDisableBlocked}
        tooltip={
          isLiveTrainingDisableBlocked
            ? t("adminPreferences.field.liveTrainingDisableBlockedTooltip", {
                count: trainerRoleUserCount,
              })
            : t("adminPreferences.field.liveTrainingTooltip")
        }
        testId={SETTINGS_PAGE_HANDLES.LIVE_TRAINING_SWITCH}
      />
    </div>
  );
}
