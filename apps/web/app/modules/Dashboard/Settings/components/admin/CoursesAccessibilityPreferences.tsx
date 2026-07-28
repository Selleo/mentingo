import { useTranslation } from "react-i18next";

import { useToggleCourseDiscussions } from "~/api/mutations/admin/useToggleCourseDiscussions";
import { useToggleLiveTraining } from "~/api/mutations/admin/useToggleLiveTraining";
import { useToggleModernCourseList } from "~/api/mutations/admin/useToggleModernCourseList";
import { useUnregisteredUserCoursesAccessibility } from "~/api/mutations/admin/useUnregisteredUserCoursesAccessibility";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { cn } from "~/lib/utils";

import { SETTINGS_PAGE_HANDLES } from "../../../../../../e2e/data/settings/handles";
import { SettingItem } from "../SettingItem";

import { COURSE_LIST_LAYOUT_VARIANT } from "./courseListLayout";
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

  const currentLayout = globalSettings.modernCourseListEnabled
    ? COURSE_LIST_LAYOUT_VARIANT.MODERN
    : COURSE_LIST_LAYOUT_VARIANT.CLASSIC;

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
          value={currentLayout}
          onValueChange={(val) => {
            if (val !== currentLayout) toggleModernCourseList();
          }}
          className="flex flex-col gap-4 sm:flex-row sm:gap-10 sm:justify-center"
        >
          {Object.values(COURSE_LIST_LAYOUT_VARIANT).map((layout) => {
            const isSelected = currentLayout === layout;
            const title =
              layout === COURSE_LIST_LAYOUT_VARIANT.CLASSIC
                ? t("adminPreferences.field.courseListLayoutClassic")
                : t("adminPreferences.field.courseListLayoutModern");
            const description =
              layout === COURSE_LIST_LAYOUT_VARIANT.CLASSIC
                ? t("adminPreferences.field.courseListLayoutClassicDescription")
                : t("adminPreferences.field.courseListLayoutModernDescription");

            return (
              <Label key={layout} htmlFor={layout} className="w-full cursor-pointer sm:flex-1">
                <div
                  className={cn(
                    "rounded-lg border-2 bg-white p-3 transition-all hover:border-primary-200 hover:bg-primary-50/30",
                    {
                      "border-primary-600 bg-primary-100 ring-1 ring-primary-200": isSelected,
                      "border-neutral-200": !isSelected,
                    },
                  )}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="mb-1 text-base font-bold">{title}</p>
                      <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                    <RadioGroupItem
                      value={layout}
                      id={layout}
                      className={cn("mt-0.5 size-5 shrink-0 border-neutral-300 bg-white", {
                        "border-primary-700 text-primary-700": isSelected,
                      })}
                    />
                  </div>
                  <CourseListLayoutPreview type={layout} />
                </div>
              </Label>
            );
          })}
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
