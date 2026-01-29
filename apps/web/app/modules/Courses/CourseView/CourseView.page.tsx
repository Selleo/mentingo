import { redirect, useNavigate, useParams, useSearchParams } from "@remix-run/react";
import { ACCESS_GUARD, SUPPORTED_LANGUAGES } from "@repo/shared";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { useCourse, useCurrentUser } from "~/api/queries";
import { PageWrapper } from "~/components/PageWrapper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ContentAccessGuard } from "~/Guards/AccessGuard";
import { useUserRole } from "~/hooks/useUserRole";
import { cn } from "~/lib/utils";
import CourseOverview from "~/modules/Courses/CourseView/CourseOverview";
import { CourseViewSidebar } from "~/modules/Courses/CourseView/CourseViewSidebar/CourseViewSidebar";
import { MoreCoursesByAuthor } from "~/modules/Courses/CourseView/MoreCoursesByAuthor";
import { YouMayBeInterestedIn } from "~/modules/Courses/CourseView/YouMayBeInterestedIn";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { isSupportedLanguage } from "~/utils/browser-language";

import { ChapterListOverview } from "./components/ChapterListOverview";
import { CourseAdminStatistics } from "./CourseAdminStatistics/CourseAdminStatistics";
import CourseCertificate from "./CourseCertificate";

import type { SupportedLanguages } from "@repo/shared";

const resolvePreferredLanguage = (url: URL): SupportedLanguages => {
  const languageFromQuery = url.searchParams.get("language");

  if (languageFromQuery && isSupportedLanguage(languageFromQuery)) {
    return languageFromQuery as SupportedLanguages;
  }

  const storedLanguage = useLanguageStore.getState().language;

  if (storedLanguage && isSupportedLanguage(storedLanguage)) {
    return storedLanguage as SupportedLanguages;
  }

  return SUPPORTED_LANGUAGES.EN;
};

export const clientLoader = async ({
  params,
  request,
}: {
  params: { id?: string };
  request: Request;
}) => {
  const idOrSlug = params.id || "";
  if (!idOrSlug) return null;

  const url = new URL(request.url);
  const language = resolvePreferredLanguage(url);

  const lookupResponse = await ApiClient.api.courseControllerLookupCourse({
    id: idOrSlug,
    language,
  });

  const { status, slug } = lookupResponse.data.data;

  if (status === "redirect" && slug) {
    const redirectUrl = new URL(`/course/${slug}`, request.url);
    throw redirect(`${redirectUrl.pathname}${redirectUrl.search ?? ""}`, 302);
  }

  return null;
};

export default function CourseViewPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const navigate = useNavigate();

  const { language: defaultLanguage } = useLanguageStore();
  const [searchParams] = useSearchParams();
  const previewLanguage = searchParams.get("language");
  const language =
    previewLanguage && isSupportedLanguage(previewLanguage) ? previewLanguage : defaultLanguage;

  const { data: course } = useCourse(id, language);

  useEffect(() => {
    const shouldCorrectUrl = course?.slug && course.slug !== id;

    if (!shouldCorrectUrl) return;

    const url = new URL(window.location.href);
    url.pathname = `/course/${course.slug}`;
    navigate(`${url.pathname}${url.search ?? ""}`, { replace: true });
  }, [course?.slug, id, navigate]);

  const { isStudent, isAdminLike } = useUserRole();
  const { data: currentUser } = useCurrentUser();

  const isPreviewMode = !course?.enrolled && isAdminLike;

  const courseViewTabs = useMemo(
    () => [
      {
        title: t("studentCourseView.tabs.chapters"),
        itemCount: course?.chapters?.length,
        content: <ChapterListOverview course={course} isPreviewMode={isPreviewMode} />,
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
    [t, course, isPreviewMode],
  );

  if (!course) return null;

  const breadcrumbs = [
    {
      title: t("studentCoursesView.breadcrumbs.courses"),
      href: "/courses",
    },
    { title: course.title, href: `/course/${id}` },
  ];

  const canView = (isForAdminLike: boolean, isForUnregistered: boolean) => {
    const hideForAdmin = isForAdminLike && (isStudent || !currentUser);
    const hideWhenUnregistered = !isForUnregistered && !currentUser;

    return !(hideForAdmin || hideWhenUnregistered);
  };

  return (
    <ContentAccessGuard type={ACCESS_GUARD.UNREGISTERED_COURSE_ACCESS}>
      <PageWrapper breadcrumbs={breadcrumbs}>
        <div className="flex w-full max-w-full flex-col gap-6 lg:grid lg:grid-cols-[1fr_480px]">
          <div className="flex flex-col gap-y-6 overflow-hidden">
            <CourseOverview course={course} />

            <CourseCertificate />

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
          </div>
          <CourseViewSidebar course={course} />
        </div>
      </PageWrapper>
    </ContentAccessGuard>
  );
}
