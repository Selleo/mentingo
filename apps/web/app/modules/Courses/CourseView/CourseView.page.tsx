import { useParams } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { useCourse, useCurrentUser } from "~/api/queries";
import { useCertificate } from "~/api/queries/useCertificates";
import { PageWrapper } from "~/components/PageWrapper";
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
  const { data: currentUser } = useCurrentUser();

  const { data: certificate } = useCertificate({
    userId: currentUser?.id ?? "",
    courseId: id,
  });

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
    <PageWrapper className="max-w-full">
      <div className="flex w-full max-w-full flex-col gap-6 lg:grid lg:grid-cols-[1fr_480px]">
        <div className="flex flex-col gap-y-6 overflow-hidden">
          <CourseOverview course={course} />
          <div className="hidden w-full items-center justify-center overflow-hidden rounded-xl border border-white bg-white px-4 shadow-sm sm:flex lg:py-44">
            {canShowCertificate && (
              <CertificateContent
                studentName={studentName}
                courseName={courseName}
                completionDate={formattedDate}
                hasBottomMargin={false}
              />
            )}
          </div>
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
