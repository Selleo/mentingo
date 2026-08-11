import { Settings } from "lucide-react";
import { Suspense, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { CourseEnrolled } from "~/modules/Admin/EditCourse/CourseEnrolled/CourseEnrolled";
import CoursePricing from "~/modules/Admin/EditCourse/CoursePricing/CoursePricing";
import { CourseSettingsSwitches } from "~/modules/Admin/EditCourse/CourseSettings/components/CourseSettingsSwitches";
import CourseStatus from "~/modules/Admin/EditCourse/CourseStatus/CourseStatus";
import { EDIT_COURSE_TABS } from "~/modules/Admin/EditCourse/EditCourse.types";
import { useEditCourseTabs } from "~/modules/Admin/EditCourse/hooks/useEditCourseTabs";

import { COURSE_OVERVIEW_HANDLES } from "../../../../../e2e/data/courses/handles";
import { CourseOverviewTabButton } from "../TableOfContent/CourseOverviewTabs";

import CourseSettingsSharingTab from "./CourseSettingsSharingTab";

import type { SupportedLanguages } from "@repo/shared";
import type { CourseStatus as CourseStatusValue } from "~/api/queries/useCourses";

const SETTINGS_TABS = {
  SETTINGS: "settings",
  STATUS: "status",
  PRICING: "pricing",
  ENROLLED: "enrolled",
  SHARING: "sharing",
} as const;

type SettingsTab = (typeof SETTINGS_TABS)[keyof typeof SETTINGS_TABS];

type CourseSettingsDrawerProps = {
  courseId: string;
  currency?: string;
  language: SupportedLanguages;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  priceInCents?: number;
  status: CourseStatusValue;
  title: string;
  unsupportedLessonCount: number;
};

export default function CourseSettingsDrawer({
  courseId,
  currency,
  language,
  onOpenChange,
  open,
  priceInCents,
  status,
  title,
  unsupportedLessonCount,
}: CourseSettingsDrawerProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>(SETTINGS_TABS.SETTINGS);
  const courseTabs = useEditCourseTabs();
  const visibleCourseTabValues = new Set(courseTabs.map((tab) => tab.value));

  const tabs: Array<{ label: string; value: SettingsTab }> = [
    { label: title, value: SETTINGS_TABS.SETTINGS },
    { label: t("adminCourseView.common.status"), value: SETTINGS_TABS.STATUS },
    ...(visibleCourseTabValues.has(EDIT_COURSE_TABS.PRICING)
      ? [{ label: t("adminCourseView.common.pricing"), value: SETTINGS_TABS.PRICING }]
      : []),
    ...(visibleCourseTabValues.has(EDIT_COURSE_TABS.ENROLLED)
      ? [
          {
            label: t("adminCourseView.common.enrolledStudents"),
            value: SETTINGS_TABS.ENROLLED,
          },
        ]
      : []),
    ...(visibleCourseTabValues.has(EDIT_COURSE_TABS.EXPORTS)
      ? [
          {
            label: t("adminCourseView.sharedCourse.exportsTitle"),
            value: SETTINGS_TABS.SHARING,
          },
        ]
      : []),
  ];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          data-testid={COURSE_OVERVIEW_HANDLES.SETTINGS_DRAWER}
          className="w-full p-0 sm:max-w-5xl"
        >
          <div className="flex h-dvh flex-col">
            <div className="border-b border-neutral-200 p-4 pr-14 md:p-6 md:pr-14">
              <SheetHeader className="space-y-0 text-left">
                <div className="flex items-center gap-3">
                  <Settings className="size-6 text-primary-700" />
                  <SheetTitle className="font-gothic text-2xl font-bold text-neutral-950">
                    {title}
                  </SheetTitle>
                </div>
                <SheetDescription className="sr-only">
                  {t("modernCourseView.overview.settingsDescription")}
                </SheetDescription>
              </SheetHeader>
            </div>

            <div className="flex gap-5 overflow-x-auto border-b border-neutral-200 px-4 pt-4 md:px-6">
              {tabs.map((tab) => (
                <CourseOverviewTabButton
                  key={tab.value}
                  active={activeTab === tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  testId={COURSE_OVERVIEW_HANDLES.settingsTab(tab.value)}
                >
                  {tab.label}
                </CourseOverviewTabButton>
              ))}
            </div>

            <div className="min-w-0 flex-1 overflow-auto p-4 md:p-6">
              {activeTab === SETTINGS_TABS.SETTINGS && (
                <CourseSettingsSwitches courseId={courseId} />
              )}
              {activeTab === SETTINGS_TABS.STATUS && (
                <CourseStatus courseId={courseId} status={status} language={language} />
              )}
              {activeTab === SETTINGS_TABS.PRICING && (
                <CoursePricing
                  courseId={courseId}
                  currency={currency}
                  priceInCents={priceInCents}
                  language={language}
                />
              )}
              {activeTab === SETTINGS_TABS.ENROLLED && (
                <Suspense
                  fallback={<div className="h-48 animate-pulse rounded-xl bg-neutral-100" />}
                >
                  <CourseEnrolled courseId={courseId} language={language} />
                </Suspense>
              )}
              {activeTab === SETTINGS_TABS.SHARING && (
                <CourseSettingsSharingTab
                  courseId={courseId}
                  language={language}
                  unsupportedLessonCount={unsupportedLessonCount}
                />
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
