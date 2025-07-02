import { isEmpty } from "lodash-es";
import { useTranslation } from "react-i18next";

import { useTeacherCourses } from "~/api/queries/useTeacherCourses";
import { useUserDetails } from "~/api/queries/useUserDetails";
import { Icon } from "~/components/Icon";
import Loader from "~/modules/common/Loader/Loader";
import { CoursesCarousel } from "~/modules/Dashboard/Courses/CoursesCarousel";

type MoreCoursesByAuthorProps = {
  courseId: string;
  teacherId: string | undefined;
};

export const MoreCoursesByAuthor = ({ courseId, teacherId }: MoreCoursesByAuthorProps) => {
  const { data: teacherCourses, isLoading } = useTeacherCourses(teacherId, {
    scope: "available",
    excludeCourseId: courseId,
  });

  const { data: teacherData } = useUserDetails(teacherId);
  const { t } = useTranslation();

  if (!teacherCourses?.length) return null;

  return (
    <section className="flex h-full w-full flex-col gap-y-6 rounded-lg bg-white p-8">
      <div className="flex flex-col">
        <h4 className="pb-1 text-2xl font-bold leading-10 text-neutral-950">
          {t("studentCourseView.otherAuthorCoursesHeader")} {teacherData?.firstName}{" "}
          {teacherData?.lastName}
        </h4>
        <p className="text-lg leading-7 text-neutral-800">
          {t("studentCourseView.otherAuthorCoursesSubheader")}
        </p>
      </div>
      <div data-testid="enrolled-courses" className="flex w-full gap-6">
        {!teacherCourses ||
          (isEmpty(teacherCourses) && (
            <div className="col-span-3 flex gap-8">
              <div>
                <Icon name="EmptyCourse" className="mr-2 text-neutral-900" />
              </div>
              <div className="flex flex-col justify-center gap-2">
                <p className="text-lg font-bold leading-5 text-neutral-950">
                  {t("studentCourseView.other.cannotFindCourses")}
                </p>
                <p className="text-base font-normal leading-6 text-neutral-800">
                  {t("studentCourseView.other.changeSearchCriteria")}
                </p>
              </div>
            </div>
          ))}
        {isLoading && (
          <div className="flex h-full items-center justify-center">
            <Loader />
          </div>
        )}
        <CoursesCarousel courses={teacherCourses} />
      </div>
    </section>
  );
};
