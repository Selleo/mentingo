import { useParams } from "@remix-run/react";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCourse, useCurrentUser } from "~/api/queries";
import { useCertificate } from "~/api/queries/useCertificates";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { Icon } from "~/components/Icon";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useUserRole } from "~/hooks/useUserRole";
import { cn } from "~/lib/utils";
import CourseOverview from "~/modules/Courses/CourseView/CourseOverview";
import { CourseViewSidebar } from "~/modules/Courses/CourseView/CourseViewSidebar/CourseViewSidebar";
import { MoreCoursesByAuthor } from "~/modules/Courses/CourseView/MoreCoursesByAuthor";
import { YouMayBeInterestedIn } from "~/modules/Courses/CourseView/YouMayBeInterestedIn";
import CertificatePreview from "~/modules/Profile/Certificates/CertificatePreview";

import { CoursesAccessGuard } from "../Courses.layout";

import { ChapterListOverview } from "./components/ChapterListOverview";
import { CourseAdminStatistics } from "./CourseAdminStatistics/CourseAdminStatistics";

export default function CourseViewPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const { data: course } = useCourse(id);
  const { isStudent } = useUserRole();
  const { data: currentUser } = useCurrentUser();
  const { data: globalSettings } = useGlobalSettings();

  const [isCertificatePreviewOpen, setCertificatePreview] = useState(false);

  const handleOpenCertificatePreview = () => setCertificatePreview(true);
  const handleCloseCertificatePreview = () => setCertificatePreview(false);

  const { data: certificate } = useCertificate({
    userId: currentUser?.id ?? "",
    courseId: id,
  });

  const hasFinishedCourse = useMemo(() => {
    return course?.completedChapterCount === course?.courseChapterCount;
  }, [course?.completedChapterCount, course?.courseChapterCount]);

  const courseViewTabs = useMemo(
    () => [
      {
        title: t("studentCourseView.tabs.chapters"),
        itemCount: course?.chapters?.length,
        content: <ChapterListOverview course={course} />,
        isForAdminLike: false,
        isForUnregistered: true,
      },
      {
        title: t("studentCourseView.tabs.moreFromAuthor"),
        content: (
          <div className="flex flex-col gap-6">
            <MoreCoursesByAuthor courseId={course?.id ?? ""} contentCreatorId={course?.authorId} />
            <YouMayBeInterestedIn courseId={course?.id} category={course?.category} />
          </div>
        ),
        isForAdminLike: false,
        isForUnregistered: false,
      },
      {
        title: t("studentCourseView.tabs.statistics"),
        content: <CourseAdminStatistics course={course} />,
        isForAdminLike: true,
        isForUnregistered: false,
      },
    ],
    [t, course],
  );

  const certificateInfo = useMemo(() => {
    if (!course || !currentUser || !isStudent) {
      return { studentName: "", courseName: "", formattedDate: "" };
    }

    const cert = certificate?.[0];

    const studentName = cert?.fullName || `${currentUser.firstName} ${currentUser.lastName}`;
    const courseName = cert?.courseTitle || course.title;
    const completionDate = cert ? cert.completionDate : null;
    const formattedDate = completionDate ? format(new Date(completionDate), "dd.MM.yyyy") : "";

    return { studentName, courseName, formattedDate };
  }, [certificate, currentUser, course, isStudent]);

  if (!course) return null;

  const breadcrumbs = [
    {
      title: t("studentCoursesView.breadcrumbs.courses"),
      href: "/courses",
    },
    { title: course.title, href: `/course/${id}` },
  ];

  const { studentName, courseName, formattedDate } = certificateInfo;

  const canView = (isForAdminLike: boolean, isForUnregistered: boolean) => {
    const hideForAdmin = isForAdminLike && (isStudent || !currentUser);
    const hideWhenUnregistered = !isForUnregistered && !currentUser;

    return !(hideForAdmin || hideWhenUnregistered);
  };

  return (
    <CoursesAccessGuard>
      <PageWrapper breadcrumbs={breadcrumbs}>
        <div className="flex w-full max-w-full flex-col gap-6 lg:grid lg:grid-cols-[1fr_480px]">
          <div className="flex flex-col gap-y-6 overflow-hidden">
            <CourseOverview course={course} />

            {hasFinishedCourse && (
              <Card className="px-4 py-4 md:px-8 flex items-center gap-4 bg-success-50">
                <div className="bg-success-50 aspect-square size-10 rounded-full grid place-items-center">
                  <Icon name="InputRoundedMarkerSuccess" className="size-4" />
                </div>
                <p className="body-sm-md grow">
                  {t("studentCourseView.certificate.courseCompleted")}
                </p>
                <div>
                  <Button variant="ghost" size="sm" onClick={handleOpenCertificatePreview}>
                    <Icon name="Eye" className="size-4 mr-2" />
                    {t("studentCourseView.certificate.button.viewCertificate")}
                  </Button>
                </div>
              </Card>
            )}

            <Tabs defaultValue={courseViewTabs[0].title} className="w-full">
              <TabsList className="bg-card w-full justify-start gap-4 p-0 overflow-hidden">
                {courseViewTabs.map((tab) => {
                  const { title, isForAdminLike, isForUnregistered } = tab;

                  if (!canView(isForAdminLike, isForUnregistered)) return null;

                  return (
                    <TabsTrigger
                      key={title}
                      value={title}
                      className="flex h-full rounded-none items-center gap-1.5 data-[state=active]:shadow-none text-neutral-900 data-[state=active]:text-primary-700 data-[state=active]:border-b-2 data-[state=active]:border-b-primary-700"
                    >
                      <span className="body-sm">{title}</span>{" "}
                      {tab.itemCount && (
                        <span className="body-sm bg-neutral-200 px-2 rounded-lg">
                          {tab.itemCount}
                        </span>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {courseViewTabs.map((tab) => {
                const { title, isForAdminLike, content, isForUnregistered } = tab;

                if (!canView(isForAdminLike, isForUnregistered)) return null;

                return (
                  <TabsContent
                    key={title}
                    value={title}
                    className={cn({
                      "data-[state=active]:mt-6": true,
                    })}
                  >
                    {content}
                  </TabsContent>
                );
              })}
            </Tabs>
            {isCertificatePreviewOpen && isStudent && (
              <button
                className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50"
                onClick={handleCloseCertificatePreview}
              >
                <div>
                  <CertificatePreview
                    studentName={studentName}
                    courseName={courseName}
                    completionDate={formattedDate}
                    onClose={handleCloseCertificatePreview}
                    platformLogo={globalSettings?.platformLogoS3Key}
                    certificateBackgroundImageUrl={globalSettings?.certificateBackgroundImage}
                  />
                </div>
              </button>
            )}
          </div>
          <CourseViewSidebar course={course} />
        </div>
      </PageWrapper>
    </CoursesAccessGuard>
  );
}
