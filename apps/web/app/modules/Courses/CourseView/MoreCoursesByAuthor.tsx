import { isEmpty } from "lodash-es";
import { useTranslation } from "react-i18next";

import { useContentCreatorCourses } from "~/api/queries/useContentCreatorCourses";
import { useUserDetails } from "~/api/queries/useUserDetails";
import { Icon } from "~/components/Icon";
import Loader from "~/modules/common/Loader/Loader";
import { CoursesCarousel } from "~/modules/Dashboard/Courses/CoursesCarousel";

type MoreCoursesByAuthorProps = {
  courseId: string;
  contentCreatorId: string | undefined;
};

export const MoreCoursesByAuthor = ({ courseId, contentCreatorId }: MoreCoursesByAuthorProps) => {
  const { data: contentCreatorCourses, isLoading } = useContentCreatorCourses(
    contentCreatorId,
    {
      scope: "available",
      excludeCourseId: courseId,
    },
    true,
  );

  const { data: contentCreatorData } = useUserDetails(contentCreatorId);
  const { t } = useTranslation();

  if (!contentCreatorCourses?.length) return null;

  return (
    <section className="flex h-full w-full flex-col gap-y-6 rounded-lg bg-white p-8">
      <div className="flex flex-col">
        <h4 className="pb-1 h6 text-neutral-950">
          {t("studentCourseView.otherAuthorCoursesHeader")} {contentCreatorData?.firstName}{" "}
          {contentCreatorData?.lastName}
        </h4>
        <p className="body-base-md text-neutral-800">
          {t("studentCourseView.otherAuthorCoursesSubheader")}
        </p>
      </div>
      <div data-testid="enrolled-courses" className="flex w-full gap-6">
        {!contentCreatorCourses ||
          (isEmpty(contentCreatorCourses) && (
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
        <CoursesCarousel courses={contentCreatorCourses} />
      </div>
    </section>
  );
};
