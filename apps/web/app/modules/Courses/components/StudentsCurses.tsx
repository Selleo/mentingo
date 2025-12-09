import { isEmpty } from "lodash-es";
import { useTranslation } from "react-i18next";

import { useStudentCourses } from "~/api/queries/useStudentCourses";
import { Icon } from "~/components/Icon";
import Loader from "~/modules/common/Loader/Loader";
import { CoursesCarousel } from "~/modules/Courses/components/CoursesCarousel";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

export const StudentsCurses = () => {
  const { t } = useTranslation();

  const { language } = useLanguageStore();

  const { data: studentCourses, isLoading: isStudentCoursesLoading } = useStudentCourses({
    language,
  });

  return (
    <div id="your-list" className="flex flex-col gap-y-6">
      <div className="flex flex-col">
        <h4 className="pb-1 h4 text-neutral-950">
          {t("studentCoursesView.enrolledCourses.header")}
        </h4>
        <p className="body-lg-md text-neutral-800">
          {t("studentCoursesView.enrolledCourses.subHeader")}
        </p>
      </div>
      <div
        data-testid="enrolled-courses"
        className="flex w-full gap-6 drop-shadow-primary lg:rounded-lg lg:bg-white lg:p-8"
      >
        {!studentCourses ||
          (isEmpty(studentCourses) && (
            <div className="col-span-3 flex gap-8">
              <div>
                <Icon name="EmptyCourse" className="mr-2 text-neutral-900" />
              </div>
              <div className="flex flex-col justify-center gap-2">
                <p className="text-lg font-bold leading-5 text-neutral-950">
                  {t("studentCoursesView.other.cannotFindCourses")}
                </p>
                <p className="text-base font-normal leading-6 text-neutral-800">
                  {t("studentCoursesView.other.changeSearchCriteria")}
                </p>
              </div>
            </div>
          ))}
        {isStudentCoursesLoading && (
          <div className="flex h-full items-center justify-center">
            <Loader />
          </div>
        )}
        <CoursesCarousel courses={studentCourses} buttonContainerClasses="lg:-right-8" />
      </div>
    </div>
  );
};
