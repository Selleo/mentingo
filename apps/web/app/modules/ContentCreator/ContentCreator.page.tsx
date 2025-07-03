import { useParams } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { useCurrentUser } from "~/api/queries";
import { useContentCreatorCourses } from "~/api/queries/useContentCreatorCourses";
import { useUserDetails } from "~/api/queries/useUserDetails";
import { ButtonGroup } from "~/components/ButtonGroup/ButtonGroup";
import { Gravatar } from "~/components/Gravatar";
import { Icon } from "~/components/Icon";
import { PageWrapper } from "~/components/PageWrapper";
import { Avatar } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import CourseCard from "~/modules/Dashboard/Courses/CourseCard";

import { ContentCreatorPageBreadcrumbs } from "./ContentCreatorPageBreadcrumbs";

export default function ContentCreatorPage() {
  const { id = "" } = useParams();
  const { data: userDetails } = useUserDetails(id);
  const { data: contentCreatorCourses } = useContentCreatorCourses(id);
  const { t } = useTranslation();
  const { data: currentUser } = useCurrentUser();

  return (
    <PageWrapper>
      {currentUser && (
        <ContentCreatorPageBreadcrumbs
          id={id}
          username={`${userDetails?.firstName} ${userDetails?.lastName}`}
        />
      )}
      <div className="flex flex-col gap-6 xl:flex-row">
        <section className="flex flex-col gap-y-6 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow xl:w-full xl:max-w-[480px]">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <Avatar className="h-20 w-20">
              <Gravatar email={userDetails?.contactEmail || ""} />
            </Avatar>
            <div className="flex flex-col">
              <h2 className="h6 text-neutral-950">
                {userDetails?.firstName} {userDetails?.lastName}
              </h2>
              <div className="flex flex-col gap-y-1">
                <p className="body-sm">
                  <span className="text-neutral-900">{t("contentCreatorView.other.title")}</span>{" "}
                  <span className="font-medium text-neutral-950">{userDetails?.jobTitle}</span>
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-y-2">
            <div className="flex items-center gap-x-3">
              <span className="text-neutral-900">{t("contentCreatorView.other.about")}</span>
              <div className="h-[1px] w-full bg-primary-200" />
            </div>
            <p className="body-base mt-2 text-neutral-950">{userDetails?.description}</p>
          </div>
          <div className="flex flex-col gap-y-1 md:gap-y-4 xl:mt-auto">
            <div className="flex items-center gap-x-3">
              <span className="text-neutral-900">{t("contentCreatorView.other.contact")}</span>
              <div className="h-[1px] w-full bg-primary-200" />
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:*:w-full">
              <a
                href={`tel:${userDetails?.contactPhone}`}
                className="body-base-md inline-flex gap-x-2 rounded-lg bg-primary-50 px-3 py-2 text-primary-700"
              >
                <Icon name="Phone" className="h-6 w-6 text-neutral-900" />
                <span>{userDetails?.contactPhone}</span>
              </a>
              <a
                href={`mailto:${userDetails?.contactEmail}`}
                className="body-base-md inline-flex gap-x-2 rounded-lg bg-primary-50 px-3 py-2 text-primary-700"
              >
                <Icon name="Email" className="h-6 w-6 text-neutral-900" />
                <span>{userDetails?.contactEmail}</span>
              </a>
            </div>
          </div>
          <Button variant="outline" className="sr-only">
            {t("contentCreatorView.button.collapse")}
          </Button>
        </section>
        <section className="flex flex-col gap-y-6 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow">
          <div className="flex flex-col gap-y-2">
            <h2 className="h5">{t("contentCreatorView.other.courses")}</h2>
            <ButtonGroup
              className="flex !w-full !max-w-none *:w-full md:!w-min"
              buttons={[
                {
                  children: "Courses",
                  isActive: true,
                },
                {
                  children: "Reviews",
                  isActive: false,
                  onClick: (e) => e.preventDefault(),
                },
              ]}
            />
            {/*TODO: Add filters*/}
          </div>
          <div className="flex flex-wrap gap-6 *:max-w-[250px] lg:max-h-[calc(100dvh-260px)] lg:overflow-y-scroll xl:gap-4">
            {contentCreatorCourses?.map((course) => <CourseCard key={course.id} {...course} />)}
          </div>
          <Button variant="outline" className="sr-only">
            {t("contentCreatorView.button.showMore")}
          </Button>
        </section>
      </div>
    </PageWrapper>
  );
}
