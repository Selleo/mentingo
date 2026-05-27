import { redirect, useNavigate, useParams, useSearchParams } from "@remix-run/react";
import { ACCESS_GUARD, PERMISSIONS, SUPPORTED_LANGUAGES } from "@repo/shared";
import { isAxiosError } from "axios";
import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { useCourse, useCurrentUser } from "~/api/queries";
import { hasPermission } from "~/common/permissions/permission.utils";
import { PageWrapper } from "~/components/PageWrapper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ContentAccessGuard } from "~/Guards/AccessGuard";
import { usePermissions } from "~/hooks/usePermissions";
import { CourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";
import CourseOverview from "~/modules/Courses/CourseView/CourseOverview";
import { CourseViewSidebar } from "~/modules/Courses/CourseView/CourseViewSidebar/CourseViewSidebar";
import { MoreCoursesByAuthor } from "~/modules/Courses/CourseView/MoreCoursesByAuthor";
import { YouMayBeInterestedIn } from "~/modules/Courses/CourseView/YouMayBeInterestedIn";
import { LearningModeBanner } from "~/modules/Courses/Lesson/LearningModeBanner";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { isSupportedLanguage } from "~/utils/browser-language";

import { COURSE_STATISTICS_HANDLES } from "../../../../e2e/data/statistics/handles";

import { ChapterListOverview } from "./components/ChapterListOverview";
import { CourseAdminStatistics } from "./CourseAdminStatistics/CourseAdminStatistics";
import CourseCertificate from "./CourseCertificate";
import { CourseChatTab } from "./CourseChat/CourseChatTab";

import type { SupportedLanguages } from "@repo/shared";

const COURSE_VIEW_TAB_QUERY_VALUES = {
  CHAPTERS: "Chapters",
  DISCUSSION: "Discussion",
  MORE_FROM_AUTHOR: "MoreFromAuthor",
  STATISTICS: "Statistics",
} as const;

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

  const lookupResponse = await ApiClient.api
    .courseControllerLookupCourse({
      id: idOrSlug,
      language,
    })
    .catch((error: unknown) => {
      if (isAxiosError(error) && error.response?.status === 404) {
        throw redirect("/courses", 302);
      }

      throw error;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const previewLanguage = searchParams.get("language");
  const language =
    previewLanguage && isSupportedLanguage(previewLanguage) ? previewLanguage : defaultLanguage;

  const { data: course, error } = useCourse(id, language);

  useEffect(() => {
    if (isAxiosError(error) && error.response?.status === 404) {
      navigate("/courses", { replace: true });
    }
  }, [error, navigate]);

  useEffect(() => {
    const shouldCorrectUrl = course?.slug && course.slug !== id;

    if (!shouldCorrectUrl) return;

    const url = new URL(window.location.href);
    url.pathname = `/course/${course.slug}`;
    navigate(`${url.pathname}${url.search ?? ""}`, { replace: true });
  }, [course?.slug, id, navigate]);

  const { hasAccess: canViewCourseStatistics } = usePermissions({
    required: PERMISSIONS.COURSE_STATISTICS,
  });
  const { data: currentUser } = useCurrentUser();

  const courseViewTabs = useMemo(
    () => [
      {
        value: "chapters",
        queryValue: COURSE_VIEW_TAB_QUERY_VALUES.CHAPTERS,
        title: t("studentCourseView.tabs.chapters"),
        itemCount: course?.chapters?.length,
        content: <ChapterListOverview />,
        isForAdminLike: false,
        isForUnregistered: true,
        isForEnrolled: false,
      },
      {
        value: "chat",
        queryValue: COURSE_VIEW_TAB_QUERY_VALUES.DISCUSSION,
        title: t("studentCourseView.tabs.chat"),
        content: (
          <CourseChatTab
            courseId={course?.id ?? ""}
            currentUserId={currentUser?.id ?? ""}
            canDeleteAnyMessage={hasPermission(
              currentUser?.permissions ?? [],
              PERMISSIONS.COURSE_DISCUSSION_MESSAGE_DELETE,
            )}
          />
        ),
        isForAdminLike: false,
        isForUnregistered: false,
        isForEnrolled: true,
      },
      {
        value: "moreFromAuthor",
        queryValue: COURSE_VIEW_TAB_QUERY_VALUES.MORE_FROM_AUTHOR,
        title: t("studentCourseView.tabs.moreFromAuthor"),
        content: (
          <div className="flex flex-col gap-6">
            <MoreCoursesByAuthor courseId={course?.id ?? ""} contentCreatorId={course?.authorId} />
            <YouMayBeInterestedIn courseId={course?.id} category={course?.category} />
          </div>
        ),
        isForAdminLike: false,
        isForUnregistered: false,
        isForEnrolled: false,
      },
      {
        value: "statistics",
        queryValue: COURSE_VIEW_TAB_QUERY_VALUES.STATISTICS,
        title: t("studentCourseView.tabs.statistics"),
        content: <CourseAdminStatistics course={course} />,
        isForAdminLike: true,
        isForUnregistered: false,
        isForEnrolled: false,
      },
    ],
    [t, course, currentUser?.id, currentUser?.permissions],
  );

  const handleTabChange = useCallback(
    (tabValue: string) => {
      const tabQueryValue = courseViewTabs.find((tab) => tab.value === tabValue)?.queryValue;
      if (!tabQueryValue) return;

      setSearchParams((prevParams) => {
        const nextParams = new URLSearchParams(prevParams);
        nextParams.set("tab", tabQueryValue);
        return nextParams;
      });
    },
    [courseViewTabs, setSearchParams],
  );

  if (!course) return null;

  const breadcrumbs = [
    {
      title: t("studentCoursesView.breadcrumbs.courses"),
      href: "/courses",
    },
    { title: course.title, href: `/course/${id}` },
  ];

  const canView = (isForAdminLike: boolean, isForUnregistered: boolean, isForEnrolled: boolean) => {
    const hideForAdmin = isForAdminLike && (!canViewCourseStatistics || !currentUser);
    const hideWhenUnregistered = !isForUnregistered && !currentUser;
    const hideWhenNotEnrolled = isForEnrolled && !course.enrolled;

    return !(hideForAdmin || hideWhenUnregistered || hideWhenNotEnrolled);
  };

  const visibleCourseTabs = courseViewTabs.filter(
    ({ isForAdminLike, isForUnregistered, isForEnrolled }) =>
      canView(isForAdminLike, isForUnregistered, isForEnrolled),
  );
  const selectedTabQuery = searchParams.get("tab");
  const activeTab =
    visibleCourseTabs.find(
      (tab) =>
        tab.queryValue.toLowerCase() === selectedTabQuery?.toLowerCase() ||
        tab.value.toLowerCase() === selectedTabQuery?.toLowerCase(),
    )?.value ?? visibleCourseTabs[0]?.value;

  return (
    <ContentAccessGuard type={ACCESS_GUARD.UNREGISTERED_COURSE_ACCESS}>
      <CourseAccessProvider course={course}>
        <PageWrapper breadcrumbs={breadcrumbs} aboveBreadcrumbs={<LearningModeBanner />}>
          <div className="flex w-full max-w-full flex-col gap-6 lg:grid lg:grid-cols-[1fr_480px]">
            <div className="flex flex-col gap-y-6 overflow-hidden">
              <CourseOverview course={course} />

              <CourseCertificate courseId={course.id} />

              <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="bg-card w-full justify-start gap-4 p-0 overflow-hidden">
                  {visibleCourseTabs.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      data-testid={
                        tab.value === "statistics"
                          ? COURSE_STATISTICS_HANDLES.COURSE_VIEW_STATISTICS_TAB
                          : undefined
                      }
                      className="flex h-full rounded-none items-center gap-1.5 data-[state=active]:shadow-none text-neutral-900 data-[state=active]:text-primary-700 data-[state=active]:border-b-2 data-[state=active]:border-b-primary-700"
                    >
                      <span className="body-sm">{tab.title}</span>{" "}
                      {tab.itemCount && (
                        <span className="body-sm bg-neutral-200 px-2 rounded-lg">
                          {tab.itemCount}
                        </span>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {visibleCourseTabs.map((tab) => (
                  <TabsContent
                    key={tab.value}
                    value={tab.value}
                    className="data-[state=active]:mt-6"
                  >
                    {tab.content}
                  </TabsContent>
                ))}
              </Tabs>
            </div>
            <CourseViewSidebar course={course} />
          </div>
        </PageWrapper>
      </CourseAccessProvider>
    </ContentAccessGuard>
  );
}
