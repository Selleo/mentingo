import { Link, Navigate } from "@remix-run/react";
import { ArrowRight, BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuditBenchmark } from "~/api/queries/useAuditBenchmark";
import { useAvailableCourses } from "~/api/queries/useAvailableCourses";
import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { PageWrapper } from "~/components/PageWrapper/PageWrapper";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { setPageTitle } from "~/utils/setPageTitle";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.aiBenchmark");

const formatChange = (value: number | null) => {
  if (value === null) return "—";
  if (value > 0) return `+${value}%`;
  return `${value}%`;
};

export default function AiBenchmarkPage() {
  const { t } = useTranslation();
  const { language } = useLanguageStore();
  const { data: benchmark, isLoading } = useAuditBenchmark();
  const { data: availableCourses } = useAvailableCourses({ language });
  const { data: currentUser } = useCurrentUser();
  const suggestedCourses = availableCourses?.slice(0, 3) ?? [];

  if (currentUser?.isManagingTenant && !currentUser.isSupportMode) {
    return <Navigate to="/audit" replace />;
  }

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="mx-auto h-72 w-full max-w-[1440px] animate-pulse rounded-xl bg-neutral-100" />
      </PageWrapper>
    );
  }

  if (!benchmark || benchmark.currentScore === null) {
    return (
      <PageWrapper>
        <Card className="mx-auto max-w-2xl border-neutral-200 p-8 text-center shadow-none md:p-12">
          <h1 className="h3 text-neutral-950">{t("aiBenchmarkView.empty.title")}</h1>
          <p className="mt-3 body-lg text-neutral-700">{t("aiBenchmarkView.empty.description")}</p>
          <Button asChild className="mt-7">
            <Link to="/audit/school">{t("aiBenchmarkView.empty.action")}</Link>
          </Button>
        </Card>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="mx-auto w-full max-w-[1440px] space-y-10">
        <div>
          <h1 className="h3 text-neutral-950">{t("aiBenchmarkView.title")}</h1>
          <p className="mt-2 body-lg text-neutral-700">{t("aiBenchmarkView.subtitle")}</p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <BenchmarkStatCard
            label={t("aiBenchmarkView.stats.score")}
            value={`${benchmark.currentScore}%`}
            detail={t("aiBenchmarkView.stats.average", { score: benchmark.averageScore ?? 0 })}
          />
          <BenchmarkStatCard
            label={t("aiBenchmarkView.stats.rank")}
            value={`${benchmark.rank ?? "—"}/${benchmark.participantCount}`}
            detail={t("aiBenchmarkView.stats.participants")}
          />
          <BenchmarkStatCard
            label={t("aiBenchmarkView.stats.improvement")}
            value={formatChange(benchmark.improvement)}
            detail={t("aiBenchmarkView.stats.previousAudit")}
          />
        </div>

        <Card className="border-primary-100 p-5 shadow-none md:p-8">
          <div className="mb-7 flex items-center justify-between gap-4">
            <h2 className="h5 text-neutral-950">{t("aiBenchmarkView.comparison.title")}</h2>
            <Badge variant="secondary">{t("aiBenchmarkView.comparison.overall")}</Badge>
          </div>
          <div className="space-y-3">
            {benchmark.comparisons.map((school) => (
              <div
                key={`${school.rank}-${school.name}`}
                className={cn(
                  "grid items-center gap-3 rounded-xl px-4 py-4 md:grid-cols-[minmax(180px,320px)_1fr_64px_56px]",
                  { "bg-primary-900 text-primary-50": school.isCurrentTenant },
                )}
              >
                <div className="body-lg-md">{school.name}</div>
                <Progress
                  value={school.score}
                  className={cn("h-3", { "bg-primary-700": school.isCurrentTenant })}
                  indicatorClassName={cn({ "bg-primary-100": school.isCurrentTenant })}
                />
                <div className="body-base-md md:text-right">{school.score}%</div>
                <div
                  className={cn("body-base-md md:text-right", {
                    "text-success-600": !school.isCurrentTenant && (school.improvement ?? 0) > 0,
                    "text-error-600": !school.isCurrentTenant && (school.improvement ?? 0) < 0,
                  })}
                >
                  {formatChange(school.improvement)}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <section>
          <h2 className="h4 text-neutral-950">{t("aiBenchmarkView.courses.title")}</h2>
          <p className="mt-2 body-lg text-neutral-600">
            {t("aiBenchmarkView.courses.description")}
          </p>
          <div className="mt-6 space-y-4">
            {suggestedCourses.map((course) => (
              <Link
                key={course.id}
                to={`/course/${course.slug || course.id}`}
                className="group flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-primary-300 hover:bg-primary-50/30 md:p-6"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-700 text-primary-50">
                  <BookOpen className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate h6 text-neutral-950">{course.title}</h3>
                  <p className="mt-1 truncate body-base text-neutral-600">{course.category}</p>
                </div>
                <ArrowRight className="size-5 text-neutral-400 transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
            {suggestedCourses.length === 0 && (
              <Card className="border-neutral-200 p-6 text-neutral-600 shadow-none">
                {t("aiBenchmarkView.courses.empty")}
              </Card>
            )}
          </div>
        </section>
      </div>
    </PageWrapper>
  );
}

type BenchmarkStatCardProps = {
  label: string;
  value: string;
  detail: string;
};

const BenchmarkStatCard = ({ label, value, detail }: BenchmarkStatCardProps) => (
  <Card className="border-primary-100 bg-primary-50/30 p-6 shadow-none md:p-8">
    <p className="details uppercase text-primary-700">{label}</p>
    <p className="mt-3 text-4xl font-semibold text-primary-950">{value}</p>
    <p className="mt-3 body-base text-neutral-500">{detail}</p>
  </Card>
);
