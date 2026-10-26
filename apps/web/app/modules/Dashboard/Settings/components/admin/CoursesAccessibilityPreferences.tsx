import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useToggleCourseDiscussions } from "~/api/mutations/admin/useToggleCourseDiscussions";
import { useToggleLiveTraining } from "~/api/mutations/admin/useToggleLiveTraining";
import { useToggleModernCourseList } from "~/api/mutations/admin/useToggleModernCourseList";
import { useUnregisteredUserCoursesAccessibility } from "~/api/mutations/admin/useUnregisteredUserCoursesAccessibility";
import { Badge } from "~/components/ui/badge";
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
      <div className="space-y-4 rounded-lg border p-3 shadow-sm">
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
          className="grid gap-4 sm:grid-cols-2"
        >
          {Object.values(COURSE_LIST_LAYOUT_VARIANT).map((layout) => {
            const isSelected = currentLayout === layout;
            const { title, description } = match(layout)
              .with(COURSE_LIST_LAYOUT_VARIANT.CLASSIC, () => ({
                title: t("adminPreferences.field.courseListLayoutClassic"),
                description: t("adminPreferences.field.courseListLayoutClassicDescription"),
              }))
              .with(COURSE_LIST_LAYOUT_VARIANT.MODERN, () => ({
                title: t("adminPreferences.field.courseListLayoutModern"),
                description: t("adminPreferences.field.courseListLayoutModernDescription"),
              }))
              .exhaustive();
            const isRecommended = layout === COURSE_LIST_LAYOUT_VARIANT.MODERN;

            return (
              <Label
                key={layout}
                htmlFor={layout}
                className="group flex cursor-pointer flex-col gap-4"
              >
                <div
                  className={cn(
                    "flex-1 rounded transition-shadow group-hover:ring-1 group-hover:ring-primary-300",
                    {
                      "ring-2 ring-primary-600 group-hover:ring-2 group-hover:ring-primary-600":
                        isSelected,
                    },
                  )}
                >
                  <CourseListLayoutPreview type={layout} />
                </div>
                <div className="flex items-start gap-3">
                  <RadioGroupItem
                    value={layout}
                    id={layout}
                    data-testid={SETTINGS_PAGE_HANDLES.courseListLayoutOption(layout)}
                    className={cn("mt-1 size-4 shrink-0 border-neutral-300 bg-white", {
                      "border-primary-700 text-primary-700": isSelected,
                    })}
                  />
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="body-base-md">{title}</span>
                      {isRecommended && (
                        <Badge variant="successFilled" className="px-2 py-0.5 text-xs">
                          {t("adminPreferences.field.courseListLayoutRecommended")}
                        </Badge>
                      )}
                    </div>
                    <p className="body-sm-md font-normal text-muted-foreground">{description}</p>
                  </div>
                </div>
              </Label>
            );
          })}
        </RadioGroup>
      </div>
    </div>
  );
}
