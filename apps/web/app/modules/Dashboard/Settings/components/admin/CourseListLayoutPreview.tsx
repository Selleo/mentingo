import { useTranslation } from "react-i18next";

import { COURSE_LIST_LAYOUT_VARIANT, type CourseListLayoutVariant } from "./courseListLayout";

interface CourseListLayoutPreviewProps {
  type: CourseListLayoutVariant;
}

export function CourseListLayoutPreview({ type }: CourseListLayoutPreviewProps) {
  const { t } = useTranslation();

  if (type === COURSE_LIST_LAYOUT_VARIANT.MODERN) {
    return (
      <div className="bg-white rounded border border-neutral-200 p-4 h-96 overflow-hidden">
        <div className="relative h-36 bg-gradient-to-br from-neutral-600 to-neutral-400 rounded overflow-hidden mb-4">
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/20 to-transparent"></div>
          <div className="absolute bottom-4 left-4 space-y-2">
            <div className="h-2 w-20 bg-white/50 rounded"></div>
            <div className="h-3.5 w-44 bg-white/70 rounded"></div>
            <div className="h-2.5 w-36 bg-white/50 rounded"></div>
            <div className="flex gap-2 mt-2">
              <div className="h-1.5 w-10 bg-white/40 rounded"></div>
              <div className="h-1.5 w-10 bg-white/40 rounded"></div>
              <div className="h-1.5 w-10 bg-white/40 rounded"></div>
            </div>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <p className="text-xs font-semibold text-neutral-900">
            {t("adminPreferences.field.courseListLayoutPreview.continueLearning")}
          </p>
          <div className="flex gap-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex-1 bg-neutral-100 rounded p-2 space-y-1.5">
                <div className="h-8 bg-neutral-200 rounded"></div>
                <div className="h-1.5 w-full bg-neutral-200 rounded"></div>
                <div className="h-1.5 w-4/5 bg-neutral-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <p className="text-xs font-semibold text-neutral-900">
            {t("adminPreferences.field.courseListLayoutPreview.topCourses")}
          </p>
          <div className="flex gap-2">
            {[1, 2, 3].map((num) => (
              <div key={num} className="flex-1 bg-neutral-100 rounded p-2 space-y-1.5">
                <div className="h-12 bg-neutral-200 rounded relative">
                  <div className="absolute top-1 left-1.5 text-2xl font-bold text-neutral-400">
                    {num}
                  </div>
                </div>
                <div className="h-1.5 w-full bg-neutral-200 rounded"></div>
                <div className="h-1.5 w-3/4 bg-neutral-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-2 w-24 bg-neutral-300 rounded"></div>
          <div className="grid grid-cols-4 gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-9 bg-neutral-200 rounded"></div>
                <div className="h-1 w-full bg-neutral-100 rounded"></div>
                <div className="h-1 w-3/5 bg-neutral-100 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded border border-neutral-200 p-4 h-96 overflow-hidden">
      <div className="space-y-2 mb-4">
        <p className="text-xs font-semibold text-neutral-900">
          {t("adminPreferences.field.courseListLayoutPreview.continueLearning")}
        </p>
        <div className="flex gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex-1 bg-neutral-100 rounded p-2 space-y-1.5">
              <div className="h-12 bg-neutral-200 rounded"></div>
              <div className="h-1.5 w-full bg-neutral-200 rounded"></div>
              <div className="h-1.5 w-3/4 bg-neutral-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-neutral-900">
          {t("adminPreferences.field.courseListLayoutPreview.availableCourses")}
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="bg-neutral-100 rounded p-2 space-y-1.5">
              <div className="h-12 bg-neutral-200 rounded"></div>
              <div className="h-1.5 w-full bg-neutral-200 rounded"></div>
              <div className="h-1.5 w-11/12 bg-neutral-200 rounded"></div>
              <div className="h-1.5 w-3/5 bg-neutral-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
