import { redirect, useNavigate, useParams, useSearchParams } from "@remix-run/react";
import { ACCESS_GUARD, SUPPORTED_LANGUAGES } from "@repo/shared";
import { isAxiosError } from "axios";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { courseLookupQueryOptions, useCourse } from "~/api/queries";
import { queryClient } from "~/api/queryClient";
import { PageWrapper } from "~/components/PageWrapper";
import { ContentAccessGuard } from "~/Guards/AccessGuard";
import { CourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";
import CourseOverview from "~/modules/Courses/CourseView/CourseOverview/CourseOverview";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { isSupportedLanguage } from "~/utils/browser-language";

import { buildCourseRedirectPath } from "./courseRedirect.utils";
import { CourseStatBar } from "./CourseStatBar/CourseStatBar";
import { LearningModeBanner } from "./LearningModeBanner";
import { TableOfContent } from "./TableOfContent/TableOfContent";

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

  const lookupCourse = await queryClient
    .fetchQuery(courseLookupQueryOptions(idOrSlug, language))
    .catch((error: unknown) => {
      if (isAxiosError(error) && error.response?.status === 404) {
        throw redirect("/courses", 302);
      }

      throw error;
    });

  const { status, slug } = lookupCourse;

  if (status === "redirect" && slug) {
    throw redirect(buildCourseRedirectPath(request.url, slug), 302);
  }

  return null;
};

export default function CourseViewPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const navigate = useNavigate();

  const { language: defaultLanguage } = useLanguageStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [openGenerateTranslationModal, setOpenGenerateTranslationModal] = useState(false);
  const previewLanguage = searchParams.get("language");
  const language =
    previewLanguage && isSupportedLanguage(previewLanguage) ? previewLanguage : defaultLanguage;

  const { data: course, error } = useCourse(id, language);

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
            <div className="flex min-w-0 flex-col gap-y-6 overflow-hidden">
              <CourseOverview
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
