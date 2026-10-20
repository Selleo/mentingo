import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useUpdateFeaturedCourse } from "~/api/mutations/admin/useUpdateFeaturedCourse";

import { COURSES_INLINE_EDIT_HANDLES } from "../../../../../../e2e/data/courses/handles";

import { CoursePickerDialog } from "./CoursePickerDialog";

type FeaturedCourseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featuredCourseId: string | null;
};

export function FeaturedCourseDialog({
  open,
  onOpenChange,
  featuredCourseId,
}: FeaturedCourseDialogProps) {
  const { t } = useTranslation();
  const { mutate: updateFeaturedCourse, isPending } = useUpdateFeaturedCourse();

  const handleSelect = (courseId: string | null) => {
    if (courseId === featuredCourseId) return onOpenChange(false);

    updateFeaturedCourse(courseId, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <CoursePickerDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("studentCoursesView.modernView.featuredCourse.label")}
      description={t("studentCoursesView.modernView.featuredCourse.dialogDescription")}
      selectedCourseId={featuredCourseId}
      isPending={isPending}
      onSelect={handleSelect}
      leadingCard={
        featuredCourseId && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleSelect(null)}
            className="flex aspect-video flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 p-4 text-center text-neutral-600 transition-colors hover:border-primary-500 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50"
            data-testid={COURSES_INLINE_EDIT_HANDLES.FEATURED_COURSE_CLEAR}
          >
            <Sparkles className="size-6" aria-hidden="true" />
            <span className="body-sm-md">
              {t("studentCoursesView.modernView.featuredCourse.automatic")}
            </span>
          </button>
        )
      }
    />
  );
}
