import { useTranslation } from "react-i18next";

import { useCourse, useCurrentUser } from "~/api/queries";
import { useUserRole } from "~/hooks/useUserRole";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

type StudentModeBannerProps = {
  courseSlug: string;
};

export function StudentModeBanner({ courseSlug }: StudentModeBannerProps) {
  const { t } = useTranslation();
  const { language } = useLanguageStore();
  const { isAdminLike } = useUserRole();
  const { data: currentUser } = useCurrentUser();
  const { data: course } = useCourse(courseSlug, language);

  if (!isAdminLike || !course) return null;

  const isStudentModeActive = currentUser?.studentModeCourseIds?.includes(course.id);

  if (!isStudentModeActive) return null;

  return (
    <div className="bg-warning-500 text-warning-950 px-4 py-2 text-sm flex items-center justify-between gap-3 border-b border-warning-600">
      <p>{t("studentCourseView.studentMode.banner", "You are in student mode for this course.")}</p>
    </div>
  );
}
