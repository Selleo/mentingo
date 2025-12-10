import { Link, useNavigate, useParams, useSearchParams } from "@remix-run/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useBetaCourseById } from "~/api/queries/admin/useBetaCourse";
import { useStripeConfigured } from "~/api/queries/useStripeConfigured";
import { Icon } from "~/components/Icon";
import { PageWrapper } from "~/components/PageWrapper";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { LeaveModalProvider } from "~/context/LeaveModalContext";
import { useTrackDataUpdatedAt } from "~/hooks/useTrackDataUpdatedAt";
import { LanguageSelector } from "~/modules/Admin/EditCourse/compontents/LanguageSelector";
import { CourseEnrolled } from "~/modules/Admin/EditCourse/CourseEnrolled/CourseEnrolled";
import { useEditCourseTabs } from "~/modules/Admin/EditCourse/hooks/useEditCourseTabs";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { setPageTitle } from "~/utils/setPageTitle";

import { getCourseBadgeVariant } from "../Courses/utils";

import CourseLessons from "./CourseLessons/CourseLessons";
import CoursePricing from "./CoursePricing/CoursePricing";
import CourseSettings from "./CourseSettings/CourseSettings";
import CourseStatus from "./CourseStatus/CourseStatus";

import type { Chapter } from "./EditCourse.types";
import type { MetaFunction } from "@remix-run/react";
import type { SupportedLanguages } from "@repo/shared";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.editCourse");

const EditCourse = () => {
  const { t } = useTranslation();
  const { id } = useParams();

  const { data: isStripeConfigured } = useStripeConfigured();

  const { language } = useLanguageStore();

  const [courseLanguage, setCourseLanguage] = useState<SupportedLanguages>(language);

  const [openGenerateTranslationModal, setOpenGenerateTranslationModal] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const params = new URLSearchParams(searchParams);
  const courseTabs = useEditCourseTabs();
  const navigate = useNavigate();

  if (!id) throw new Error("Course ID not found");

  const {
    data: course,
    isFetching,
    isLoading,
    dataUpdatedAt,
    error,
  } = useBetaCourseById(id, courseLanguage);

  const { previousDataUpdatedAt, currentDataUpdatedAt } = useTrackDataUpdatedAt(dataUpdatedAt);

  useEffect(() => {
    if (!isFetching && !course?.availableLocales.includes(courseLanguage)) {
      setCourseLanguage(course?.baseLanguage ?? language);
    }
  }, [language, courseLanguage, course, isFetching]);

  const handleTabChange = (tabValue: string) => {
    params.set("tab", tabValue);
    setSearchParams(params);
  };

  const canRefetchChapterList =
    previousDataUpdatedAt && currentDataUpdatedAt && previousDataUpdatedAt < currentDataUpdatedAt;

  useEffect(() => {
    if (error) {
      navigate("/");
    }
  }, [error, navigate]);

  if (error) return null;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="size-32 animate-spin rounded-full border-b-2 border-t-2 border-gray-900"></div>
      </div>
    );
  }

  const breadcrumbs = [
    { title: t("adminCourseView.breadcrumbs.courses"), href: "/admin/courses" },
    { title: course?.title || "", href: `/admin/beta-courses/${id}` },
  ];

  return (
    <PageWrapper breadcrumbs={breadcrumbs}>
      <Tabs
        value={searchParams.get("tab") ?? "Curriculum"}
        className="flex h-full flex-col gap-y-4"
      >
        <div className="flex w-full flex-col gap-y-4 rounded-lg border border-gray-200 bg-white px-8 py-6 shadow-md">
          <div className="flex items-center justify-between">
            <h4 className="h4 flex items-center text-neutral-950 mr-2">
              {course?.title || ""}

              {course?.status === "published" && (
                <Badge
                  variant={getCourseBadgeVariant(course?.status)}
                  fontWeight="bold"
                  className="ml-2"
                  icon="Success"
                >
                  {t("common.other.published")}
                </Badge>
              )}
              {course?.status === "draft" && (
                <Badge
                  variant={getCourseBadgeVariant(course?.status)}
                  fontWeight="bold"
                  className="ml-2"
                  icon="Warning"
                >
                  {t("common.other.draft")}
                </Badge>
              )}
              {course?.status === "private" && (
                <Badge
                  variant={getCourseBadgeVariant(course?.status)}
                  fontWeight="bold"
                  className="ml-2"
                >
                  {t("common.other.private")}
                </Badge>
              )}
            </h4>

            <div className="flex gap-4 items-center">
              <div className="flex gap-2 items-center">
                <LanguageSelector
                  courseLanguage={courseLanguage}
                  course={
                    course && {
                      id: course.id,
                      baseLanguage: course.baseLanguage,
                      availableLocales: course.availableLocales,
                    }
                  }
                  onChange={setCourseLanguage}
                  setOpenGenerateTranslationModal={setOpenGenerateTranslationModal}
                />

                {/*Backend functionality will come in a second PR */}
                <Dialog
                  open={openGenerateTranslationModal}
                  onOpenChange={setOpenGenerateTranslationModal}
                >
                  <DialogContent>
                    <DialogTitle>
                      {t("adminCourseView.common.generateMissingTranslations")}
                    </DialogTitle>
                    <DialogDescription>
                      {t("adminCourseView.common.generateMissingTranslationsDescription")}
                    </DialogDescription>
                    <DialogFooter>
                      <DialogTrigger asChild>
                        <Button variant="outline">{t("contentCreatorView.button.cancel")}</Button>
                      </DialogTrigger>
                      <Button>{t("contentCreatorView.button.confirm")}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <Separator orientation="vertical" className="h-10" decorative />

              <Button
                asChild
                className="border border-neutral-200 bg-transparent text-accent-foreground"
              >
                <Link to={`/course/${course?.id}`}>
                  <Icon name="Eye" className="mr-2" />
                  {t("adminCourseView.common.preview")}
                </Link>
              </Button>
            </div>
          </div>
          <TabsList className="w-min">
            {courseTabs.map(({ label, value }) => (
              <TabsTrigger key={value} value={value} onClick={() => handleTabChange(value)}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="Settings">
          <CourseSettings
            key={`${course?.id}-${courseLanguage}`}
            courseId={course?.id || ""}
            title={course?.title}
            description={course?.description}
            categoryId={course?.categoryId}
            thumbnailS3SingedUrl={course?.thumbnailS3SingedUrl}
            thumbnailS3Key={course?.thumbnailS3Key}
            hasCertificate={course?.hasCertificate || false}
            courseLanguage={courseLanguage}
          />
        </TabsContent>
        <TabsContent value="Curriculum" className="h-full overflow-hidden">
          <LeaveModalProvider>
            <CourseLessons
              chapters={course?.chapters as Chapter[]}
              canRefetchChapterList={!!canRefetchChapterList}
              language={courseLanguage}
              baseLanguage={course?.baseLanguage ?? courseLanguage}
            />
          </LeaveModalProvider>
        </TabsContent>
        {isStripeConfigured?.enabled && (
          <TabsContent value="Pricing">
            <CoursePricing
              courseId={course?.id || ""}
              currency={course?.currency}
              priceInCents={course?.priceInCents}
              language={language}
            />
          </TabsContent>
        )}
        <TabsContent value="Status">
          <CourseStatus
            courseId={course?.id || ""}
            status={course?.status || "draft"}
            language={language}
          />
        </TabsContent>
        <TabsContent value="Enrolled">
          <CourseEnrolled />
        </TabsContent>
      </Tabs>
    </PageWrapper>
  );
};

export default EditCourse;
