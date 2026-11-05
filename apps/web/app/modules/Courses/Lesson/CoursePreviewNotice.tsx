import { Link, useLocation } from "@remix-run/react";
import { COURSE_STATUSES, PERMISSIONS } from "@repo/shared";
import { Eye } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useEnrollCourse, useToggleCourseStudentMode } from "~/api/mutations";
import { useCurrentUser } from "~/api/queries";
import { hasPermission } from "~/common/permissions/permission.utils";
import { Button } from "~/components/ui/button";
import { useIsRegistrationEnabled } from "~/hooks/useIsRegistrationEnabled";
import { useCourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";
import { PaymentModal } from "~/modules/stripe/PaymentModal";

export function CoursePreviewNotice() {
  const { t } = useTranslation();
  const location = useLocation();
  const { course, isPreviewMode } = useCourseAccessProvider();
  const { data: currentUser } = useCurrentUser();
  const isRegistrationEnabled = useIsRegistrationEnabled();
  const { mutate: enrollCourse, isPending: isEnrolling } = useEnrollCourse();
  const { mutate: toggleLearningMode, isPending: isTogglingLearningMode } =
    useToggleCourseStudentMode(course.id);
  const canUseLearningMode = hasPermission(
    currentUser?.permissions ?? [],
    PERMISSIONS.LEARNING_MODE_USE,
  );
  const canEnroll = hasPermission(
    currentUser?.permissions ?? [],
    PERMISSIONS.LEARNING_PROGRESS_UPDATE,
  );

  if (!isPreviewMode) return null;

  const renderAction = () => {
    if (canUseLearningMode) {
      return (
        <Button
          type="button"
          disabled={isTogglingLearningMode || course.status === COURSE_STATUSES.DRAFT}
          onClick={() => toggleLearningMode({ enabled: true })}
        >
          {t("modernCourseView.learningMode.enter")}
        </Button>
      );
    }

    if (!currentUser) {
      const authPath = isRegistrationEnabled ? "/auth/register" : "/auth/login";
      return (
        <Button asChild>
          <Link
            to={`${authPath}?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`}
          >
            {t("studentCourseView.sideSection.button.enrollCourse")}
          </Link>
        </Button>
      );
    }

    if (!canEnroll || course.enrolled) return null;

    if (course.priceInCents && course.currency && course.stripePriceId) {
      return (
        <PaymentModal
          courseCurrency={course.currency}
          coursePrice={course.priceInCents}
          courseTitle={course.title}
          courseDescription={course.description}
          courseId={course.id}
          coursePriceId={course.stripePriceId}
        />
      );
    }

    return (
      <Button type="button" disabled={isEnrolling} onClick={() => enrollCourse({ id: course.id })}>
        {t("studentCourseView.sideSection.button.enrollCourse")}
      </Button>
    );
  };

  return (
    <aside
      aria-label={t("studentLessonView.preview.title")}
      className="mb-6 flex flex-col items-start gap-4 rounded-lg border border-primary-200 bg-primary-50 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <Eye className="mt-0.5 size-5 shrink-0 text-primary-700" aria-hidden="true" />
        <div>
          <p className="body-base-md text-neutral-950">{t("studentLessonView.preview.title")}</p>
          <p className="body-sm text-neutral-800">
            {t(
              canUseLearningMode
                ? "studentLessonView.preview.learningModeDescription"
                : "studentLessonView.preview.enrollmentDescription",
            )}
          </p>
        </div>
      </div>
      <div className="shrink-0">{renderAction()}</div>
    </aside>
  );
}
