import { redirect, useNavigate, useParams, useSearchParams } from "@remix-run/react";
import { ACCESS_GUARD, SUPPORTED_LANGUAGES } from "@repo/shared";
import { isAxiosError } from "axios";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { courseLookupQueryOptions, useCourse } from "~/api/queries";
import { queryClient } from "~/api/queryClient";
import { PageWrapper } from "~/components/PageWrapper";
import { ContentAccessGuard } from "~/Guards/AccessGuard";
import { CourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";
import CourseOverview from "~/modules/Courses/CourseView/CourseOverview/CourseOverview";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { isSupportedLanguage } from "~/utils/browser-language";

import { CourseStatBar } from "./CourseStatBar";
import { LearningModeBannerNew } from "./LearningModeBannerNew";
import { TableOfContent } from "./TableOfContent";

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
        <PageWrapper breadcrumbs={breadcrumbs} aboveBreadcrumbs={<LearningModeBannerNew />}>
          <div className="flex w-full max-w-full flex-col">
            <div className="flex flex-col gap-y-6 overflow-hidden">
              <CourseOverview course={course} language={language} />
              <CourseStatBar course={course} language={language} />
              <TableOfContent course={course} />
            </div>
          </div>
        </PageWrapper>
      </CourseAccessProvider>
    </ContentAccessGuard>
  );
}
