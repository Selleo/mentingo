import { useLoaderData, useParams } from "@remix-run/react";
import { Award, ListChecks, ListOrdered } from "lucide-react";
import { useTranslation } from "react-i18next";

import { learningPathQueryOptions } from "~/api/queries/useLearningPaths";
import { queryClient } from "~/api/queryClient";
import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";
import { PageWrapper } from "~/components/PageWrapper";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { setPageTitle } from "~/utils/setPageTitle";

import { LEARNING_PATHS_PAGE_HANDLES } from "../../../e2e/data/learning-paths/handles";

import { LearningPathCertificate } from "./components/LearningPathCertificate";
import { LearningPathCourseRow } from "./components/LearningPathCourseRow";
import { LearningPathStatusBadge } from "./components/LearningPathStatusBadge";

import type { ClientLoaderFunctionArgs, MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) =>
  setPageTitle(matches, "pages.learningPathDetails");

export const clientLoader = async ({ params }: ClientLoaderFunctionArgs) => {
  if (!params.id) {
    throw new Error("Missing learning path id.");
  }

  const { language } = useLanguageStore.getState();

  return queryClient.fetchQuery(learningPathQueryOptions(params.id, { language }));
};

export default function LearningPathDetailsPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const learningPath = useLoaderData<typeof clientLoader>();

  return (
    <PageWrapper
      breadcrumbs={[
        {
          title: t("learningPathsView.breadcrumbs.learningPaths"),
          href: "/learning-paths",
        },
        {
          title: learningPath.data.title || t("learningPathsView.breadcrumbs.details"),
          href: `/learning-paths/${id}`,
        },
      ]}
    >
      <section
        className="flex flex-col gap-6 md:gap-8"
        data-testid={LEARNING_PATHS_PAGE_HANDLES.DETAILS_PAGE}
      >
        <div className="relative overflow-hidden rounded-[2rem] border border-neutral-200 bg-neutral-950 text-white shadow-[0_20px_60px_rgba(15,23,42,0.16)]">
          <div className="absolute inset-0">
            <img
              src={learningPath.data.thumbnailReference || DefaultPhotoCourse}
              alt={learningPath.data.title || t("learningPathsView.detailsTitle")}
              className="h-full w-full object-cover opacity-30"
              onError={(event) => {
                event.currentTarget.src = DefaultPhotoCourse;
              }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,23,42,0.74)_52%,rgba(15,23,42,0.9))]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_32%)]" />
          </div>
          <div className="relative grid gap-8 p-6 sm:p-8 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)] xl:items-end xl:p-10">
            <div className="max-w-3xl space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <LearningPathStatusBadge status={learningPath.data.progress} />
                <LearningPathStatusBadge status={learningPath.data.status} />
                <Badge
                  variant="default"
                  className="border-white/15 bg-white/10 text-white backdrop-blur"
                >
                  <ListOrdered className="size-4" />
                  {learningPath.data.sequenceEnabled
                    ? t("learningPathsView.badges.sequenceEnabled")
                    : t("learningPathsView.badges.freeOrder")}
                </Badge>
                {learningPath.data.includesCertificate && (
                  <Badge
                    variant={learningPath.data.certificateReady ? "success" : "default"}
                    className="border-white/15 bg-white/10 text-white backdrop-blur"
                  >
                    <Award className="size-4" />
                    {learningPath.data.certificateReady
                      ? t("learningPathsView.certificate.ready")
                      : t("learningPathsView.certificate.available")}
                  </Badge>
                )}
              </div>
              <div className="space-y-3">
                <h1 className="h3 text-white">
                  {learningPath.data.title || t("learningPathsView.detailsTitle")}
                </h1>
                <p className="body-base max-w-2xl text-white/78">
                  {learningPath.data.description || t("learningPathsView.emptyDescription")}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur">
                  <p className="details-md text-white/60">
                    {t("learningPathsView.progress.title")}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    {learningPath.data.progressValue}%
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur">
                  <p className="details-md text-white/60">
                    {t("learningPathsView.detail.courses")}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    {learningPath.data.completedCourseCount}/{learningPath.data.totalCourseCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur">
                  <p className="details-md text-white/60">
                    {t("learningPathsView.badges.certificate")}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    {learningPath.data.certificateReady
                      ? t("learningPathsView.certificate.ready")
                      : t("learningPathsView.certificate.available")}
                  </p>
                </div>
              </div>
            </div>

            <div className="w-full rounded-[1.75rem] border border-white/10 bg-white/10 p-5 backdrop-blur-xl xl:max-w-[360px]">
              <div className="flex items-center justify-between gap-4">
                <span className="body-sm-md text-white">
                  {t("learningPathsView.progress.title")}
                </span>
                <span className="body-sm-md text-white/80">{learningPath.data.progressValue}%</span>
              </div>
              <Progress
                value={learningPath.data.progressValue}
                className="mt-4 h-3 bg-white/10"
                indicatorClassName="bg-gradient-to-r from-white via-white to-white/70"
              />
              <p className="details-md mt-4 text-white/70">
                {t("learningPathsView.progress.summary", {
                  completed: learningPath.data.completedCourseCount,
                  total: learningPath.data.totalCourseCount,
                })}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-2xl border border-white/10 bg-neutral-950/35 px-4 py-3">
                  <p className="details-md text-white/60">
                    {t("learningPathsView.detail.courses")}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {learningPath.data.courses.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-neutral-950/35 px-4 py-3">
                  <p className="details-md text-white/60">
                    {t("adminLearningPathsView.table.status")}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {t(`learningPathsView.status.${learningPath.data.status}`)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-2xl bg-primary-50 text-primary-700">
            <ListChecks className="size-5" />
          </div>
          <div>
            <h2 className="h5 text-neutral-950">{t("learningPathsView.detail.courses")}</h2>
            <p className="details-md text-neutral-600">
              {t("learningPathsView.progress.summary", {
                completed: learningPath.data.completedCourseCount,
                total: learningPath.data.totalCourseCount,
              })}
            </p>
          </div>
        </div>

        {learningPath.data.includesCertificate && (
          <LearningPathCertificate
            learningPathId={learningPath.data.id}
            title={learningPath.data.title || t("learningPathsView.detailsTitle")}
            certificateReady={learningPath.data.certificateReady}
          />
        )}

        {learningPath.data.courses.length ? (
          <ol className="flex flex-col gap-4">
            {learningPath.data.courses.map((course, index) => (
              <LearningPathCourseRow key={course.id} course={course} index={index} />
            ))}
          </ol>
        ) : (
          <div className="rounded-[1.75rem] border border-neutral-200 bg-white p-8 text-neutral-700 shadow-sm">
            {t("learningPathsView.detail.emptyCourses")}
          </div>
        )}
      </section>
    </PageWrapper>
  );
}
