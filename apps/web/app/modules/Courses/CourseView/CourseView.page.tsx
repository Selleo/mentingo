import { useParams } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { useCourse, useCurrentUser } from "~/api/queries";
import { useCertificate } from "~/api/queries/useCertificates";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { PageWrapper } from "~/components/PageWrapper";
import { useUserRole } from "~/hooks/useUserRole";
import { CourseChapter } from "~/modules/Courses/CourseView/CourseChapter";
import CourseOverview from "~/modules/Courses/CourseView/CourseOverview";
import { CourseViewSidebar } from "~/modules/Courses/CourseView/CourseViewSidebar/CourseViewSidebar";
import { MoreCoursesByAuthor } from "~/modules/Courses/CourseView/MoreCoursesByAuthor";
import { YouMayBeInterestedIn } from "~/modules/Courses/CourseView/YouMayBeInterestedIn";
import CertificateContent from "~/modules/Profile/Certificates/CertificateContent";

export default function CourseViewPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const { data: course } = useCourse(id);
  const { isStudent } = useUserRole();
  const { data: currentUser } = useCurrentUser();
  const { data: globalSettings } = useGlobalSettings();

  const { data: certificate } = useCertificate({
    userId: currentUser?.id ?? "",
    courseId: id,
  });

  if (!course) return null;

  const breadcrumbs = [
    {
      title: isStudent
        ? t("studentCourseView.breadcrumbs.yourCourses")
        : t("studentCourseView.breadcrumbs.availableCourses"),
      href: "/courses",
    },
    { title: course.title, href: `/course/${id}` },
  ];

  const backButton = { title: t("studentCourseView.breadcrumbs.back"), href: "/courses" };

  const canShowCertificate =
    course?.hasCertificate && certificate !== undefined && certificate.length > 0;

  if (!course || !currentUser) return null;

  const studentName: string =
    certificate?.[0]?.fullName || `${currentUser.firstName} ${currentUser.lastName}`;
  const courseName: string = certificate?.[0]?.courseTitle || course.title;
  const completionDate =
    certificate && certificate.length > 0
      ? certificate[0].completionDate || certificate[0].createdAt
      : null;
  const formattedDate = completionDate
    ? new Date(completionDate).toISOString().split("T")[0].replaceAll("-", ".")
    : "";

  return (
    <PageWrapper breadcrumbs={breadcrumbs} backButton={backButton}>
      <div className="flex w-full max-w-full flex-col gap-6 lg:grid lg:grid-cols-[1fr_480px]">
        <div className="flex flex-col gap-y-6 overflow-hidden">
          <CourseOverview course={course} />
          {canShowCertificate && (
            <div className="hidden aspect-video w-full rounded-xl border border-white bg-white shadow-sm sm:block">
              <CertificateContent
                studentName={studentName}
                courseName={courseName}
                completionDate={formattedDate}
                backgroundImageUrl={globalSettings?.certificateBackgroundImage}
                platformLogo={globalSettings?.platformLogoS3Key}
              />
            </div>
          )}
          <div className="flex flex-col gap-y-4 rounded-lg bg-white px-4 py-6 md:p-8">
            <div className="flex flex-col gap-y-1">
              <h4 className="h6 text-neutral-950">{t("studentCourseView.header")}</h4>
              <p className="body-base-md text-neutral-800">{t("studentCourseView.subHeader")}</p>
            </div>
            {course.chapters?.map((chapter) => {
              if (!chapter) return null;
              return (
                <CourseChapter chapter={chapter} key={chapter.id} enrolled={course.enrolled} />
              );
            })}
          </div>
          <MoreCoursesByAuthor courseId={course.id} contentCreatorId={course.authorId} />
          <YouMayBeInterestedIn courseId={course.id} category={course.category} />
        </div>
        <CourseViewSidebar course={course} />
      </div>
    </PageWrapper>
  );
}
