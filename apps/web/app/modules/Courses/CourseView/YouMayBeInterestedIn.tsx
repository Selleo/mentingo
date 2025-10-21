import { isEmpty } from "lodash-es";
import { useTranslation } from "react-i18next";

import { useAvailableCourses } from "~/api/queries";
import { Icon } from "~/components/Icon";
import Loader from "~/modules/common/Loader/Loader";
import { CoursesCarousel } from "~/modules/Dashboard/Courses/CoursesCarousel";

type YouMayBeInterestedInProps = {
  category?: string;
  courseId?: string;
};

export const YouMayBeInterestedIn = ({ category, courseId }: YouMayBeInterestedInProps) => {
  const { data: relatedCourses, isLoading } = useAvailableCourses({
    category,
    excludeCourseId: courseId,
  });
  const { t } = useTranslation();

  if (!relatedCourses?.length) return null;

  return (
    <section className="flex h-full w-full flex-col gap-y-6 rounded-lg bg-white p-8">
      <div className="flex flex-col">
        <h4 className="pb-1 h6 text-neutral-950">{t("studentCourseView.recommendedHeader")}</h4>
        <p className="body-base-md text-neutral-800">
          {t("studentCourseView.recommendedSubheader")}
        </p>
      </div>
      <div data-testid="enrolled-courses" className="gap-6w-full flex">
        {!relatedCourses ||
          (isEmpty(relatedCourses) && (
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
        <CoursesCarousel courses={relatedCourses} />
      </div>
    </section>
  );
};
