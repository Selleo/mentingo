import { useTranslation } from "react-i18next";

import ErrorPage from "~/components/ErrorPage/ErrorPage";
import { LOGIN_REDIRECT_URL } from "~/modules/Auth/constants";

import { COURSE_UNAVAILABLE_REASONS, type CourseUnavailableReason } from "./CourseView.constants";

type CourseUnavailableProps = {
  reason: CourseUnavailableReason;
  canAccessCourseList: boolean;
};

export default function CourseUnavailable({ reason, canAccessCourseList }: CourseUnavailableProps) {
  const { t } = useTranslation();

  if (reason === COURSE_UNAVAILABLE_REASONS.NOT_FOUND) {
    return (
      <ErrorPage
        iconName="Search"
        title={t("studentCoursesView.courseUnavailable.notFoundTitle")}
        description={t("studentCoursesView.courseUnavailable.notFoundDescription")}
        actionLabel={t(
          canAccessCourseList
            ? "studentCoursesView.courseUnavailable.goToCourseList"
            : "studentCoursesView.courseUnavailable.goToHome",
        )}
        actionIcon="ArrowRight"
        to={canAccessCourseList ? "/courses" : LOGIN_REDIRECT_URL}
      />
    );
  }

  return (
    <ErrorPage
      title={t("studentCoursesView.courseUnavailable.accessTitle")}
      description={t("studentCoursesView.courseUnavailable.accessDescription")}
      actionLabel={t("studentCoursesView.courseUnavailable.goToLogin")}
      actionIcon="ArrowRight"
      to="/auth/login"
    />
  );
}
