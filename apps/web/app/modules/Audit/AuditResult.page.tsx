import { Link, Navigate, useParams } from "@remix-run/react";
import {
  AUDIT_DEFINITIONS,
  AUDIT_TYPES,
  getAuditDefinition,
  isAuditType,
  type AuditType,
} from "@repo/shared";
import { Award, BookOpen, CalendarDays, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuditSubmission } from "~/api/queries/useAuditSubmission";
import { useAvailableCourses } from "~/api/queries/useAvailableCourses";
import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { PageWrapper } from "~/components/PageWrapper/PageWrapper";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { setPageTitle } from "~/utils/setPageTitle";

import { getAuditLevelKey, getRoadmapPhasePeriods } from "./auditResult.utils";

import type { RoadmapPace } from "./auditResult.utils";
import type { MetaFunction } from "@remix-run/react";
import type { GetAvailableCoursesResponse } from "~/api/generated-api";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.auditResult");

type Course = GetAvailableCoursesResponse["data"][number];
type ScoreEntry = [string, number];

const isUuid = (value: string | undefined) =>
  Boolean(
    value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  );

export default function AuditResultPage() {
  const { type, id } = useParams();
  const { data: currentUser } = useCurrentUser();

  if (!isAuditType(type) || !id || !isUuid(id)) return <Navigate to="/audit" replace />;
  if (type === AUDIT_TYPES.SCHOOL && currentUser?.isManagingTenant && !currentUser.isSupportMode) {
    return <Navigate to="/audit" replace />;
  }

  return <AuditResultContent type={type} id={id} />;
}

const AuditResultContent = ({ type, id }: { type: AuditType; id: string }) => {
  const { t, i18n } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const [pace, setPace] = useState<RoadmapPace>("3");
  const { data: audit, isLoading, isError } = useAuditSubmission(type, id);
  const { data: availableCourses } = useAvailableCourses({ language });
  const { data: globalSettings } = useGlobalSettings();

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="mx-auto h-96 w-full max-w-6xl animate-pulse rounded-xl bg-neutral-100" />
      </PageWrapper>
    );
  }

  if (isError || !audit) {
    return (
      <PageWrapper>
        <Card className="mx-auto max-w-xl border-neutral-200 p-8 text-center shadow-none">
          <h1 className="h4 text-neutral-950">{t("auditView.result.notFound")}</h1>
        </Card>
      </PageWrapper>
    );
  }

  const isSchoolAudit = type === AUDIT_TYPES.SCHOOL;
  const definition = getAuditDefinition(type, audit.definitionVersion) ?? AUDIT_DEFINITIONS[type];
  const definitionOrder = new Map<string, number>(
    definition.questions.map((question, index) => [question.competency, index]),
  );
  const competencyScores = Object.entries(audit.competencyScores).sort(
    ([left], [right]) =>
      (definitionOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (definitionOrder.get(right) ?? Number.MAX_SAFE_INTEGER),
  );
  const scoresByPriority = [...competencyScores].sort((left, right) => left[1] - right[1]);
  const weakest = scoresByPriority.slice(0, Math.min(2, scoresByPriority.length));
  const strongest = scoresByPriority.at(-1);
  const courses = availableCourses?.slice(0, 8) ?? [];
  const date = new Intl.DateTimeFormat(i18n.language, {
    month: "long",
    year: "numeric",
  }).format(new Date(audit.completedAt));
  const companyName =
    globalSettings?.companyInformation?.companyName ?? t("auditView.school.title");
  const subtitle = isSchoolAudit
    ? t("auditView.result.schoolSubtitle", { date, company: companyName })
    : t("auditView.result.individualSubtitle", { date });
  const resultTitle = isSchoolAudit
    ? t("auditView.result.schoolTitle")
    : t("auditView.result.individualTitle");

  return (
    <PageWrapper
      breadcrumbs={[
        { title: t("auditView.title"), href: "/audit" },
        { title: resultTitle, href: `/audit/results/${type}/${id}` },
      ]}
    >
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <header>
          <h1 className="h3 text-neutral-950">{resultTitle}</h1>
          <p className="mt-1 body-base text-neutral-600">{subtitle}</p>
        </header>

        <section className="grid gap-4 md:grid-cols-[280px_1fr]">
          <Card className="flex min-h-64 flex-col items-center justify-center border-primary-900 bg-primary-900 p-7 text-center text-primary-50 shadow-none">
            <p className="body-base text-primary-200">
              {isSchoolAudit
                ? t("auditView.result.schoolScore")
                : t("auditView.result.overallScore")}
            </p>
            <p className="mt-2 text-5xl font-semibold">{audit.score}%</p>
            <Badge className="mt-3 bg-primary-50 text-primary-800 hover:bg-primary-50">
              {t(`auditView.result.levels.${getAuditLevelKey(audit.score)}`)}
            </Badge>
          </Card>

          <Card className="border-primary-100 p-6 shadow-none md:p-7">
            <h2 className="details uppercase text-neutral-500">
              {isSchoolAudit
                ? t("auditView.result.departmentScores")
                : t("auditView.result.categoryBreakdown")}
            </h2>
            <div className="mt-5 space-y-4">
              {competencyScores.map(([competency, score]) => (
                <div key={competency}>
                  <div className="mb-1.5 flex items-center justify-between gap-4">
                    <span className="body-sm-md text-neutral-800">
                      {t(`auditView.competencies.${competency}`)}
                    </span>
                    <span className="body-sm-md text-neutral-700">{score}%</span>
                  </div>
                  <Progress value={score} className="h-2 bg-neutral-100" />
                </div>
              ))}
            </div>
          </Card>
        </section>

        <MeaningCard
          type={type}
          strongest={strongest}
          weakest={weakest}
          translateCompetency={(competency) => t(`auditView.competencies.${competency}`)}
        />

        <Roadmap
          type={type}
          pace={pace}
          onPaceChange={setPace}
          courses={courses}
          weakest={weakest}
          translateCompetency={(competency) => t(`auditView.competencies.${competency}`)}
        />
      </div>
    </PageWrapper>
  );
};

type MeaningCardProps = {
  type: AuditType;
  strongest: ScoreEntry | undefined;
  weakest: ScoreEntry[];
  translateCompetency: (competency: string) => string;
};

const MeaningCard = ({ type, strongest, weakest, translateCompetency }: MeaningCardProps) => {
  const { t } = useTranslation();
  const firstWeakest = weakest[0];
  const secondWeakest = weakest[1] ?? weakest[0];
  const values = {
    strongest: strongest ? translateCompetency(strongest[0]) : "—",
    strongestScore: strongest?.[1] ?? 0,
    weakest: firstWeakest ? translateCompetency(firstWeakest[0]) : "—",
    weakestScore: firstWeakest?.[1] ?? 0,
    secondWeakest: secondWeakest ? translateCompetency(secondWeakest[0]) : "—",
    secondWeakestScore: secondWeakest?.[1] ?? 0,
  };
  const meaningKey =
    type === AUDIT_TYPES.SCHOOL
      ? "auditView.result.meaning.school"
      : "auditView.result.meaning.individual";

  return (
    <Card className="border-primary-100 bg-primary-50/20 p-6 shadow-none md:p-7">
      <h2 className="details uppercase text-neutral-500">{t("auditView.result.meaning.title")}</h2>
      <p className="mt-3 body-base leading-7 text-neutral-700">{t(meaningKey, values)}</p>
    </Card>
  );
};

type RoadmapProps = {
  type: AuditType;
  pace: RoadmapPace;
  onPaceChange: (pace: RoadmapPace) => void;
  courses: Course[];
  weakest: ScoreEntry[];
  translateCompetency: (competency: string) => string;
};

type RoadmapPhase = {
  title: string;
  courses: Course[];
  action?: RoadmapAction;
  milestone?: RoadmapMilestone;
};

type RoadmapAction = "seniorStaff" | "workingGroup" | "rerunSchool" | "rerunIndividual";
type RoadmapMilestone = "enabledBadge" | "pioneerBadge";

const Roadmap = ({
  type,
  pace,
  onPaceChange,
  courses,
  weakest,
  translateCompetency,
}: RoadmapProps) => {
  const { t } = useTranslation();
  const isSchoolAudit = type === AUDIT_TYPES.SCHOOL;
  const periods = getRoadmapPhasePeriods(pace);
  const priorityArea = weakest[0]
    ? translateCompetency(weakest[0][0])
    : t("auditView.roadmap.gaps");
  const secondaryArea = weakest[1]
    ? translateCompetency(weakest[1][0])
    : t("auditView.roadmap.confidence");
  let courseLimit = 4;
  let phases: RoadmapPhase[] = [
    {
      title: t("auditView.roadmap.priorityArea", { area: priorityArea }),
      courses: courses.slice(0, 2),
      action: isSchoolAudit ? "seniorStaff" : undefined,
    },
    {
      title: t("auditView.roadmap.buildArea", { area: secondaryArea }),
      courses: courses.slice(2, 3),
      action: isSchoolAudit ? "workingGroup" : "rerunIndividual",
    },
    {
      title: t("auditView.roadmap.milestone"),
      courses: courses.slice(3, 4),
      action: isSchoolAudit ? "rerunSchool" : undefined,
    },
  ];

  if (pace === "6") {
    courseLimit = 7;
    phases = [
      {
        title: t("auditView.roadmap.priorityArea", { area: priorityArea }),
        courses: courses.slice(0, 2),
      },
      {
        title: t("auditView.roadmap.completeLevel2"),
        courses: courses.slice(2, 4),
      },
      {
        title: t("auditView.roadmap.level2Certificate"),
        courses: [],
        milestone: "enabledBadge",
      },
      {
        title: t("auditView.roadmap.introduceLevel3"),
        courses: courses.slice(4, 6),
      },
      {
        title: t("auditView.roadmap.deepenPractice"),
        courses: courses.slice(6, 7),
      },
      {
        title: t("auditView.roadmap.level3Milestone"),
        courses: [],
        action: isSchoolAudit ? "rerunSchool" : "rerunIndividual",
      },
    ];
  }

  if (pace === "12") {
    courseLimit = 8;
    phases = [
      {
        title: t("auditView.roadmap.completeLevel2"),
        courses: courses.slice(0, 3),
        milestone: "enabledBadge",
      },
      {
        title: t("auditView.roadmap.level3Foundation"),
        courses: courses.slice(3, 6),
      },
      {
        title: t("auditView.roadmap.leadShare"),
        courses: courses.slice(6, 7),
        action: isSchoolAudit ? "workingGroup" : undefined,
      },
      {
        title: t("auditView.roadmap.aiPioneer"),
        courses: courses.slice(7, 8),
        milestone: "pioneerBadge",
      },
    ];
  }

  const visibleCourseCount = Math.min(courses.length, courseLimit);
  const getPeriodLabel = (period: string) => {
    if (period.startsWith("q")) return t(`auditView.roadmap.quarters.${period}`);
    return t("auditView.roadmap.month", { period });
  };
  const getHeaderTone = (index: number) => {
    if (index === 0 || (pace === "6" && index === 4)) return "bg-primary-900";
    if (index === 1 || index === phases.length - 1) return "bg-primary-800";
    if (index === 2) return "bg-primary-700";
    return "bg-primary-600";
  };

  return (
    <section className="pb-8 pt-2">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h2 className="h4 text-neutral-950">
            {isSchoolAudit
              ? t("auditView.roadmap.schoolTitle")
              : t("auditView.roadmap.individualTitle")}
          </h2>
          <p className="mt-1 body-base text-neutral-500">{t("auditView.roadmap.description")}</p>
          <p className="mt-5 body-sm text-neutral-500">{t("auditView.roadmap.courses")}</p>
          <p className="body-base-md text-neutral-950">
            {t("auditView.roadmap.summary", { count: visibleCourseCount, months: pace })}
          </p>
        </div>
        <Tabs value={pace} onValueChange={(value) => onPaceChange(value as RoadmapPace)}>
          <TabsList className="h-10 bg-primary-50">
            {(["3", "6", "12"] as const).map((value) => (
              <TabsTrigger key={value} value={value} className="min-w-14">
                {t("auditView.roadmap.monthShort", { months: value })}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div
        className={cn("mt-6 grid grid-cols-2 overflow-hidden rounded-xl", {
          "md:grid-cols-3": pace === "3",
          "md:grid-cols-6": pace === "6",
          "md:grid-cols-4": pace === "12",
        })}
      >
        {phases.map((phase, index) => (
          <div
            key={periods[index]}
            className={cn("min-h-24 p-4 text-primary-50", getHeaderTone(index))}
          >
            <p className="text-[11px] font-semibold uppercase text-primary-200">
              {getPeriodLabel(periods[index])}
            </p>
            <p className="mt-1 body-sm-md">{phase.title}</p>
            <p className="mt-1 text-xs text-primary-100">
              {t("auditView.roadmap.courseCount", { count: phase.courses.length })}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-7 space-y-8">
        {phases.map((phase, index) => (
          <div key={periods[index]} className="grid gap-4 md:grid-cols-[32px_1fr]">
            <div className="flex size-6 items-center justify-center rounded-full bg-primary-700 text-xs font-semibold text-primary-50">
              {index + 1}
            </div>
            <div>
              <div className="mb-3 flex flex-wrap items-baseline gap-2">
                <h3 className="h6 text-neutral-950">{getPeriodLabel(periods[index])}</h3>
                <span className="body-sm text-neutral-500">{phase.title}</span>
              </div>
              <div className="space-y-2">
                {phase.courses.map((course, courseIndex) => (
                  <CourseRoadmapItem
                    key={course.id}
                    course={course}
                    priority={index === 0 && courseIndex < 2}
                  />
                ))}
                {phase.action && <ActionRoadmapItem action={phase.action} />}
                {phase.milestone && <MilestoneRoadmapItem milestone={phase.milestone} />}
                {phase.courses.length === 0 && !phase.action && !phase.milestone && (
                  <Card className="border-neutral-200 p-5 text-neutral-500 shadow-none">
                    {t("auditView.roadmap.noCourse")}
                  </Card>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const CourseRoadmapItem = ({ course, priority }: { course: Course; priority: boolean }) => {
  const { t } = useTranslation();

  return (
    <Link
      to={`/course/${course.slug || course.id}`}
      className="group flex items-center gap-4 rounded-xl border border-primary-100 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-primary-50/30"
    >
      <div
        className={cn("h-10 w-1 shrink-0 rounded-full bg-primary-100", {
          "bg-primary-700": priority,
        })}
      />
      <BookOpen className="size-5 shrink-0 text-neutral-600" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h4 className="truncate body-base-md text-neutral-950">{course.title}</h4>
        <p className="mt-0.5 truncate body-sm text-neutral-500">
          {course.category}
          {course.estimatedDurationFormatted ? ` · ${course.estimatedDurationFormatted}` : ""}
        </p>
      </div>
      {priority && (
        <Badge className="shrink-0 bg-warning-50 text-warning-700 hover:bg-warning-50">
          {t("auditView.roadmap.priority")}
        </Badge>
      )}
      <ChevronRight className="size-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-1" />
    </Link>
  );
};

const ActionRoadmapItem = ({ action }: { action: RoadmapAction }) => {
  const { t } = useTranslation();

  return (
    <Card className="flex items-center gap-4 border-primary-100 p-4 shadow-none">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-50">
        <CalendarDays className="size-4 text-primary-700" aria-hidden="true" />
      </div>
      <div>
        <h4 className="body-base-md text-neutral-950">
          {t(`auditView.roadmap.actions.${action}.title`)}
        </h4>
        <p className="mt-0.5 body-sm text-neutral-500">
          {t(`auditView.roadmap.actions.${action}.description`)}
        </p>
      </div>
    </Card>
  );
};

const MilestoneRoadmapItem = ({ milestone }: { milestone: RoadmapMilestone }) => {
  const { t } = useTranslation();

  return (
    <Card className="flex items-center gap-4 border-dashed border-primary-200 bg-primary-50/20 p-4 shadow-none">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-700">
        <Award className="size-4 text-primary-50" aria-hidden="true" />
      </div>
      <h4 className="min-w-0 flex-1 body-base-md text-neutral-950">
        {t(`auditView.roadmap.milestones.${milestone}`)}
      </h4>
      <Badge className="bg-primary-50 text-primary-700 hover:bg-primary-50">
        {t("auditView.roadmap.milestoneBadge")}
      </Badge>
    </Card>
  );
};
