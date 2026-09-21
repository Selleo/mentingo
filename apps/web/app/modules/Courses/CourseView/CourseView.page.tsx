import { redirect, useLoaderData, useNavigate, useParams, useSearchParams } from "@remix-run/react";
import { ACCESS_GUARD, PERMISSIONS, SUPPORTED_LANGUAGES } from "@repo/shared";
import { isAxiosError } from "axios";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  courseLookupQueryOptions,
  courseQueryOptions,
  currentUserQueryOptions,
  useCourse,
} from "~/api/queries";
import { globalSettingsQueryOptions } from "~/api/queries/useGlobalSettings";
import { userSettingsQueryOptions } from "~/api/queries/useUserSettings";
import { queryClient } from "~/api/queryClient";
import { hasPermission } from "~/common/permissions/permission.utils";
import { PageWrapper } from "~/components/PageWrapper";
import { ContentAccessGuard } from "~/Guards/AccessGuard";
import { CourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";
import CourseOverview from "~/modules/Courses/CourseView/CourseOverview/CourseOverview";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { isSupportedLanguage } from "~/utils/browser-language";
import { saveEntryToNavigationHistory } from "~/utils/saveEntryToNavigationHistory";

import { buildCourseRedirectPath } from "./courseRedirect.utils";
import { CourseStatBar } from "./CourseStatBar/CourseStatBar";
import CourseUnavailable from "./CourseUnavailable";
import {
  COURSE_UNAVAILABLE_REASONS,
  COURSE_VIEW_LOADER_STATUS,
  type CourseUnavailableReason,
} from "./CourseView.constants";
import { LearningModeBanner } from "./LearningModeBanner";
import { TableOfContent } from "./TableOfContent/TableOfContent";

import type { SupportedLanguages } from "@repo/shared";

type CourseViewLoaderData =
  | { status: (typeof COURSE_VIEW_LOADER_STATUS)["AVAILABLE"] }
  | {
      status: (typeof COURSE_VIEW_LOADER_STATUS)["UNAVAILABLE"];
      reason: CourseUnavailableReason;
      canAccessCourseList: boolean;
    }
  | null;

const getNotFoundLoaderData = (canAccessCourseList: boolean) =>
  ({
    status: COURSE_VIEW_LOADER_STATUS.UNAVAILABLE,
    reason: COURSE_UNAVAILABLE_REASONS.NOT_FOUND,
    canAccessCourseList,
  }) as const;

const resolvePreferredLanguage = (
  url: URL,
  applicationLanguage?: string | null,
): SupportedLanguages => {
  const languageFromQuery = url.searchParams.get("language");

  if (languageFromQuery && isSupportedLanguage(languageFromQuery)) {
    return languageFromQuery as SupportedLanguages;
  }

  if (applicationLanguage && isSupportedLanguage(applicationLanguage)) {
    return applicationLanguage as SupportedLanguages;
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

  const [currentUserResponse, globalSettingsResponse, userSettingsResponse] = await Promise.all([
    queryClient.ensureQueryData(currentUserQueryOptions),
    queryClient.ensureQueryData(globalSettingsQueryOptions),
    queryClient.ensureQueryData(userSettingsQueryOptions),
  ]);

  const currentUser = currentUserResponse?.data;

  if (!currentUser && !globalSettingsResponse?.data?.unregisteredUserCoursesAccessibility) {
    saveEntryToNavigationHistory(request);

    return {
      status: COURSE_VIEW_LOADER_STATUS.UNAVAILABLE,
      reason: COURSE_UNAVAILABLE_REASONS.REQUIRES_AUTHENTICATION,
      canAccessCourseList: false,
    } as const;
  }

  const language = resolvePreferredLanguage(url, userSettingsResponse?.data?.language);
  useLanguageStore.getState().setLanguage(language);

  const lookupCourse = await queryClient
    .fetchQuery(courseLookupQueryOptions(idOrSlug, language))
    .catch((error: unknown) => {
      if (isAxiosError(error) && error.response?.status === 404) {
        return getNotFoundLoaderData(
          !currentUser || hasPermission(currentUser.permissions, PERMISSIONS.COURSE_READ),
        );
      }

      throw error;
    });

  if (lookupCourse.status === COURSE_VIEW_LOADER_STATUS.UNAVAILABLE) return lookupCourse;

  const { status, slug } = lookupCourse;

  if (status === "redirect" && slug) {
    throw redirect(buildCourseRedirectPath(request.url, slug), 302);
  }

  const courseResponse = await queryClient
    .ensureQueryData(courseQueryOptions(idOrSlug, language))
    .catch((error: unknown) => {
      if (isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    });

  if (!courseResponse)
    return getNotFoundLoaderData(
      !currentUser || hasPermission(currentUser.permissions, PERMISSIONS.COURSE_READ),
    );

  return { status: COURSE_VIEW_LOADER_STATUS.AVAILABLE } as const;
};

export default function CourseViewPage() {
  const loaderData = useLoaderData() as CourseViewLoaderData;

  const { t } = useTranslation();
  const { id = "" } = useParams();
  const navigate = useNavigate();

  const { language: defaultLanguage } = useLanguageStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [openGenerateTranslationModal, setOpenGenerateTranslationModal] = useState(false);
  const previewLanguage = searchParams.get("language");
  const language =
    previewLanguage && isSupportedLanguage(previewLanguage) ? previewLanguage : defaultLanguage;

  const { data: course, error } = useCourse(
    id,
    language,
    loaderData?.status === COURSE_VIEW_LOADER_STATUS.AVAILABLE,
  );

  const handleCourseLanguageChange = useCallback(
    (nextLanguage: SupportedLanguages) => {
      setSearchParams(
        (currentSearchParams) => {
          const nextSearchParams = new URLSearchParams(currentSearchParams);
          nextSearchParams.set("language", nextLanguage);
          return nextSearchParams;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

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

  useEffect(() => {
    if (course && !course.availableLocales.includes(language)) {
      handleCourseLanguageChange(course.baseLanguage);
    }
  }, [course, handleCourseLanguageChange, language]);

  if (loaderData?.status === COURSE_VIEW_LOADER_STATUS.UNAVAILABLE) {
    return (
      <CourseUnavailable
        reason={loaderData.reason}
        canAccessCourseList={loaderData.canAccessCourseList}
      />
    );
  }

  if (!course) return null;
  const breadcrumbs = [
    {
      title: t("studentCoursesView.breadcrumbs.courses"),
      href: "/courses",
    },
    { title: course.title, href: `/course/${id}` },
  ];

  return (
    <ContentAccessGuard type={ACCESS_GUARD.UNREGISTERED_COURSE_ACCESS}>
      <CourseAccessProvider course={course}>
        <PageWrapper breadcrumbs={breadcrumbs} aboveBreadcrumbs={<LearningModeBanner />}>
          <div className="flex w-full min-w-0 max-w-full flex-col">
            <div className="flex min-w-0 flex-col gap-y-3 pb-3 md:gap-y-4 md:pb-4">
              <CourseOverview
                idOrSlug={id}
                language={language}
                onLanguageChange={handleCourseLanguageChange}
                openGenerateTranslationModal={openGenerateTranslationModal}
                setOpenGenerateTranslationModal={setOpenGenerateTranslationModal}
              />
              <CourseStatBar language={language} />
              <TableOfContent language={language} />
            </div>
          </div>
        </PageWrapper>
      </CourseAccessProvider>
    </ContentAccessGuard>
  );
}
