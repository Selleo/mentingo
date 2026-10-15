import { Activity, Award, BookOpen, CircleCheckBig, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Progress } from "~/components/ui/progress";

import { formatReportPercent } from "../reports.utils";

import type { LucideIcon } from "lucide-react";
import type { RunReportResponse } from "~/api/generated-api";

type ReportMetricsProps = {
  metrics: RunReportResponse["data"]["metrics"];
};

type HeadlineMetric = {
  key: string;
  icon: LucideIcon;
  label: string;
  value: string | number;
  context: string;
  rate?: number | null;
};

export function ReportHeadlineMetrics({ metrics }: ReportMetricsProps) {
  const { t } = useTranslation();
  const headline: HeadlineMetric[] = [
    {
      key: "learners",
      icon: Users,
      label: t("reports.metrics.learners"),
      value: metrics.learners,
      context: t("reports.metrics.people"),
    },
    {
      key: "platformCourses",
      icon: BookOpen,
      label: t("reports.metrics.platformCourses"),
      value: metrics.platformCourses,
      context: t("reports.metrics.platformCoursesContext"),
    },
    {
      key: "courseCompletionRate",
      icon: CircleCheckBig,
      label: t("reports.metrics.completionRate"),
      value: formatReportPercent(metrics.courseCompletionRate),
      context: t("reports.metrics.ofMatchingEnrollments"),
      rate: metrics.courseCompletionRate,
    },
    {
      key: "activeLearners30d",
      icon: Activity,
      label: t("reports.metrics.activeLearners"),
      value: metrics.activeLearners30d,
      context: t("reports.metrics.last30Days"),
    },
  ];

  return (
    <section
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      aria-label={t("reports.metrics.title")}
    >
      {headline.map(({ key, icon: MetricIcon, label, value, context, rate }) => (
        <article
          key={key}
          className="flex flex-col gap-1 rounded-lg border border-neutral-200 bg-white p-5"
        >
          <p className="body-sm-md flex items-center gap-2 text-neutral-600">
            <MetricIcon className="size-4 shrink-0 text-neutral-500" aria-hidden="true" />
            {label}
          </p>
          <p className="h4 text-neutral-950">{value}</p>
          <p className="details text-neutral-500">{context}</p>
          {rate !== undefined && (
            <Progress
              value={rate ?? 0}
              aria-hidden
              className="mt-2 h-1.5 bg-neutral-100"
              indicatorClassName="bg-primary-600"
            />
          )}
        </article>
      ))}
    </section>
  );
}

export function ReportOutcomeMetrics({ metrics }: ReportMetricsProps) {
  const { t } = useTranslation();
  const outcomes = [
    {
      key: "averageProgress",
      label: t("reports.metrics.averageProgress"),
      context: t("reports.metrics.matchingLearning"),
      value: formatReportPercent(metrics.averageProgress),
      rate: metrics.averageProgress,
    },
    {
      key: "averageScore",
      label: t("reports.metrics.averageScore"),
      context: t("reports.metrics.quizScores"),
      value: formatReportPercent(metrics.averageScore),
      rate: metrics.averageScore,
    },
    {
      key: "activeCertificates",
      label: t("reports.metrics.activeCertificates"),
      context: t("reports.metrics.activeCertificateContext"),
      value: metrics.activeCertificates,
    },
    {
      key: "certificatesIssued",
      label: t("reports.metrics.certificates"),
      context: t("reports.metrics.issued"),
      value: metrics.certificatesIssued,
    },
    {
      key: "developmentPathsCompleted",
      label: t("reports.metrics.pathsCompleted"),
      context: t("reports.metrics.allActivePaths"),
      value: metrics.developmentPathsCompleted,
    },
  ];

  return (
    <section className="flex flex-col rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="body-base-md flex items-center gap-2 text-neutral-950">
        <Award className="size-4 text-neutral-500" aria-hidden="true" />
        {t("reports.metrics.outcomesTitle")}
      </h3>
      <dl className="mt-2 divide-y divide-neutral-100">
        {outcomes.map(({ key, label, context, value, rate }) => (
          <div key={key} className="flex flex-col gap-1.5 py-3 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="min-w-0">
                <span className="body-sm-md block text-neutral-800">{label}</span>
                <span className="details block text-neutral-500">{context}</span>
              </dt>
              <dd className="body-base-md shrink-0 text-neutral-950">{value}</dd>
            </div>
            {rate !== undefined && (
              <Progress
                value={rate ?? 0}
                aria-hidden
                className="h-1 bg-neutral-100"
                indicatorClassName="bg-primary-500"
              />
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
