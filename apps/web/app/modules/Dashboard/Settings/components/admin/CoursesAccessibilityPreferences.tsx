import { useTranslation } from "react-i18next";

import { useToggleCourseDiscussions } from "~/api/mutations/admin/useToggleCourseDiscussions";
import { useToggleLiveTraining } from "~/api/mutations/admin/useToggleLiveTraining";
import { useToggleModernCourseList } from "~/api/mutations/admin/useToggleModernCourseList";
import { useUnregisteredUserCoursesAccessibility } from "~/api/mutations/admin/useUnregisteredUserCoursesAccessibility";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";

import { SETTINGS_PAGE_HANDLES } from "../../../../../../e2e/data/settings/handles";
import { SettingItem } from "../SettingItem";

import { CourseListLayoutPreview } from "./CourseListLayoutPreview";

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
  const { mutate: toggleCourseDiscussions } = useToggleCourseDiscussions();
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
      <div className="space-y-3">
        <div className="space-y-0.5">
          <p className="body-base-md">{t("adminPreferences.field.courseListLayout")}</p>
          <p className="body-sm-md text-muted-foreground">
            {t("adminPreferences.field.courseListLayoutDescription")}
          </p>
        </div>
        <RadioGroup
          value={globalSettings.modernCourseListEnabled ? "modern" : "classic"}
          onValueChange={(val) => {
            const current = globalSettings.modernCourseListEnabled ? "modern" : "classic";
            if (val !== current) toggleModernCourseList();
          }}
          className="flex flex-col gap-4 sm:flex-row sm:gap-10 sm:justify-center"
        >
          {(["classic", "modern"] as const).map((layout) => (
            <Label key={layout} htmlFor={layout} className="w-full cursor-pointer sm:flex-1">
              <RadioGroupItem value={layout} id={layout} className="sr-only" />
              <div
                className={`border-2 rounded-lg p-3 transition-colors ${
                  (globalSettings.modernCourseListEnabled ? "modern" : "classic") === layout
                    ? "border-primary bg-primary/5"
                    : "border-neutral-200 hover:border-neutral-300"
                }`}
              >
                <p className="text-base font-bold capitalize mb-1">{layout}</p>
                <p className="text-sm text-muted-foreground mb-2">
                  {layout === "classic"
                    ? t("adminPreferences.field.courseListLayoutClassicDescription")
                    : t("adminPreferences.field.courseListLayoutModernDescription")}
                </p>
                <CourseListLayoutPreview type={layout} />
              </div>
            </Label>
          ))}
        </RadioGroup>
      </div>
      <SettingItem
        id="courseDiscussions"
        label={t("adminPreferences.field.courseDiscussions")}
        description={t("adminPreferences.field.courseDiscussionsDescription")}
        checked={globalSettings.courseDiscussionsEnabled}
        onCheckedChange={toggleCourseDiscussions}
        testId={SETTINGS_PAGE_HANDLES.COURSE_DISCUSSIONS_SWITCH}
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
