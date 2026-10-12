import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "@remix-run/react";
import { ACCESS_GUARD, PERMISSIONS } from "@repo/shared";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCourseAvailabilitySuspense } from "~/api/queries/useCourseAvailabilitySuspense";
import { useCourseLookupSuspense } from "~/api/queries/useCourseLookup";
import { useCurrentUserSessionSuspense } from "~/api/queries/useCurrentUserSessionSuspense";
import { usePublicGlobalSettingsSuspense } from "~/api/queries/usePublicGlobalSettingsSuspense";
import { useUserSettingsSuspense } from "~/api/queries/useUserSettings";
import { hasPermission } from "~/common/permissions/permission.utils";
import { PageWrapper } from "~/components/PageWrapper";
import { ContentAccessGuard } from "~/Guards/AccessGuard";
import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";
import { CourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";
import CourseOverview from "~/modules/Courses/CourseView/CourseOverview/CourseOverview";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { isSupportedLanguage } from "~/utils/browser-language";

import { CourseStatBar } from "./CourseStatBar/CourseStatBar";
import CourseUnavailable from "./CourseUnavailable";
import { COURSE_UNAVAILABLE_REASONS } from "./CourseView.constants";
import { LearningModeBanner } from "./LearningModeBanner";
import { TableOfContent } from "./TableOfContent/TableOfContent";

import type { SupportedLanguages } from "@repo/shared";

export default function CourseViewPage() {
  const { data: currentUser } = useCurrentUserSessionSuspense();
  const { data: globalSettings } = usePublicGlobalSettingsSuspense();
  const location = useLocation();
  const addLastUnauthorizedEntry = useNavigationHistoryStore(
    (state) => state.addLastUnauthorizedEntry,
  );
  const requiresAuthentication =
    !currentUser && !globalSettings?.unregisteredUserCoursesAccessibility;

  useEffect(() => {
    if (requiresAuthentication) {
      addLastUnauthorizedEntry({
        pathname: `${location.pathname}${location.search}`,
        timestamp: Date.now(),
      });
    }
  }, [requiresAuthentication, addLastUnauthorizedEntry, location.pathname, location.search]);

  if (requiresAuthentication) {
    return (
      <CourseUnavailable
        reason={COURSE_UNAVAILABLE_REASONS.REQUIRES_AUTHENTICATION}
        canAccessCourseList={false}
      />
    );
  }

  if (currentUser) {
    return (
      <AuthenticatedCourseLanguage
        canAccessCourseList={hasPermission(currentUser.permissions, PERMISSIONS.COURSE_READ)}
      />
    );
  }

  return <CourseLanguageAndLookup canAccessCourseList />;
}

function AuthenticatedCourseLanguage({ canAccessCourseList }: { canAccessCourseList: boolean }) {
  const { data: userSettings } = useUserSettingsSuspense();
  return (
    <CourseLanguageAndLookup
      canAccessCourseList={canAccessCourseList}
      applicationLanguage={userSettings?.language}
    />
  );
}

function CourseLanguageAndLookup({
  canAccessCourseList,
  applicationLanguage,
}: {
  canAccessCourseList: boolean;
  applicationLanguage?: string | null;
}) {
  const [searchParams] = useSearchParams();
  const storedLanguage = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const requestedLanguage = searchParams.get("language");
  let language = storedLanguage;
  if (applicationLanguage && isSupportedLanguage(applicationLanguage)) {
    language = applicationLanguage;
  }
  if (requestedLanguage && isSupportedLanguage(requestedLanguage)) {
    language = requestedLanguage;
  }

  useEffect(() => {
    setLanguage(language);
  }, [language, setLanguage]);

  return <CourseLookup language={language} canAccessCourseList={canAccessCourseList} />;
}

function CourseLookup({
  language,
  canAccessCourseList,
}: {
  language: SupportedLanguages;
  canAccessCourseList: boolean;
}) {
  const { id = "" } = useParams();
  const location = useLocation();
  const { data: lookupCourse } = useCourseLookupSuspense(id, language);

  if (!lookupCourse) {
    return (
      <CourseUnavailable
        reason={COURSE_UNAVAILABLE_REASONS.NOT_FOUND}
        canAccessCourseList={canAccessCourseList}
      />
    );
  }
  if (lookupCourse.status === "redirect" && lookupCourse.slug) {
    return <Navigate replace to={`/course/${lookupCourse.slug}${location.search}`} />;
  }

  return <CourseContent canAccessCourseList={canAccessCourseList} language={language} />;
}

function CourseContent({
  canAccessCourseList,
  language,
}: {
  canAccessCourseList: boolean;
  language: SupportedLanguages;
}) {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [, setSearchParams] = useSearchParams();
  const [openGenerateTranslationModal, setOpenGenerateTranslationModal] = useState(false);

  const { data: course } = useCourseAvailabilitySuspense(id, language);

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
    const shouldCorrectUrl = course?.slug && course.slug !== id;

    if (!shouldCorrectUrl) return;

    navigate(`/course/${course.slug}${location.search}`, { replace: true });
  }, [course?.slug, id, location.search, navigate]);

  useEffect(() => {
    if (course && !course.availableLocales.includes(language)) {
      handleCourseLanguageChange(course.baseLanguage);
    }
  }, [course, handleCourseLanguageChange, language]);

  if (!course) {
    return (
      <CourseUnavailable
        reason={COURSE_UNAVAILABLE_REASONS.NOT_FOUND}
        canAccessCourseList={canAccessCourseList}
      />
    );
  }
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
