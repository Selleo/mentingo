import { useParams } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { useTeacherCourses } from "~/api/queries/useTeacherCourses";
import { useUserDetails } from "~/api/queries/useUserDetails";
import { ButtonGroup } from "~/components/ButtonGroup/ButtonGroup";
import { Gravatar } from "~/components/Gravatar";
import { Icon } from "~/components/Icon";
import { PageWrapper } from "~/components/PageWrapper";
import { Avatar } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import CourseCard from "~/modules/Dashboard/Courses/CourseCard";

import { ProfilePageBreadcrumbs } from "./ProfilePageBreadcrumbs";

export default function ProfilePage() {
  const { id = "" } = useParams();
  const { data: userDetails } = useUserDetails(id);

  const { data: teacherCourses } = useTeacherCourses(id);
  const { t } = useTranslation();
  return (
    <PageWrapper>
      {userDetails && (
        <ProfilePageBreadcrumbs
          id={id}
          username={`${userDetails?.firstName} ${userDetails?.lastName}`}
        />
      )}
      <div className="flex flex-col gap-6 xl:flex-row">
        <section className="flex flex-col gap-y-6 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow xl:w-full xl:max-w-[480px]">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <Avatar className="h-20 w-20">
              {/* Using email for avatar lookup may cause issues if the email changes. Is there a plan to handle this? Would using a public user ID for the profile image be simpler? Also contactEmail is empty for students */}
              <Gravatar email={userDetails?.contactEmail || ""} />
            </Avatar>
            <div className="flex flex-col">
              <h2 className="h6 text-neutral-950">{`${userDetails?.firstName} ${userDetails?.lastName}`}</h2>
              <div className="flex flex-col gap-y-1">
                {userDetails?.role === "teacher" && (
                  <p className="body-sm">
                    <span className="text-neutral-900">{t("teacherView.other.title")}</span>{" "}
                    <span className="font-medium text-neutral-950">{userDetails?.jobTitle}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
          {userDetails?.role === "teacher" && (
            <div className="flex flex-col gap-y-2">
              <div className="flex items-center gap-x-3">
                <span className="text-neutral-900">{t("teacherView.other.about")}</span>
                <div className="h-[1px] w-full bg-primary-200" />
              </div>
              <p className="body-base mt-2 text-neutral-950">{userDetails?.description}</p>
            </div>
          )}
          {userDetails?.role === "teacher" && (
            <div className="flex flex-col gap-y-1 md:gap-y-4 xl:mt-auto">
              <div className="flex items-center gap-x-3">
                <span className="text-neutral-900">{t("teacherView.other.contact")}</span>
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
          )}
          {userDetails?.role === "teacher" && (
            <Button variant="outline" className="sr-only">
              {t("teacherView.button.collapse")}
            </Button>
          )}
        </section>
        {userDetails?.role === "teacher" && (
          <section className="flex flex-col gap-y-6 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow">
            <div className="flex flex-col gap-y-2">
              <h2 className="h5">{t("teacherView.other.courses")}</h2>
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
              {teacherCourses?.map((course) => <CourseCard key={course.id} {...course} />)}
            </div>
            <Button variant="outline" className="sr-only">
              {t("teacherView.button.showMore")}
            </Button>
          </section>
        )}
      </div>
    </PageWrapper>
  );
}
