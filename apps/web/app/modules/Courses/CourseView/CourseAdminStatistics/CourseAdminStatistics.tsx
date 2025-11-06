import { TabsList } from "@radix-ui/react-tabs";
import { useParams } from "@remix-run/react";
import { useMemo, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useCourseAverageScorePerQuiz } from "~/api/queries/admin/useCourseAverageScorePerQuiz";
import { useCourseStatistics } from "~/api/queries/admin/useCourseStatistics";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsContent, TabsTrigger } from "~/components/ui/tabs";
import { TooltipProvider } from "~/components/ui/tooltip";
import { useUserRole } from "~/hooks/useUserRole";
import { LessonType } from "~/modules/Admin/EditCourse/EditCourse.types";
import {
  SearchFilter,
  type FilterValue,
  type FilterConfig,
} from "~/modules/common/SearchFilter/SearchFilter";

import {
  CourseAdminStatisticsCard,
  CourseStatusDistributionChart,
  AverageScorePerQuizChart,
  CourseStudentsProgressTable,
  CourseStudentsQuizResultsTable,
} from "./components";
import { CourseStudentsAiMentorResultsTable } from "./components/CourseStudentsAiMentorResults";

import type { GetCourseResponse } from "~/api/generated-api";
import type { CourseStudentsAiMentorResultsQueryParams } from "~/api/queries/admin/useCourseStudentsAiMentorResults";
import type { CourseStudentsProgressQueryParams } from "~/api/queries/admin/useCourseStudentsProgress";
import type { CourseStudentsQuizResultsQueryParams } from "~/api/queries/admin/useCourseStudentsQuizResults";

const StatisticsTabs = {
  progress: "progress",
  quizResults: "quizResults",
  aiMentorResults: "aiMentorResults",
} as const;

type AdminCourseStatisticsTab = (typeof StatisticsTabs)[keyof typeof StatisticsTabs];

interface CourseAdminStatisticsProps {
  course?: GetCourseResponse["data"];
}

export function CourseAdminStatistics({ course }: CourseAdminStatisticsProps) {
  const { t } = useTranslation();

  const { id = "" } = useParams();
  const { isAdminLike } = useUserRole();

  const [activeTab, setActiveTab] = useState<AdminCourseStatisticsTab>("progress");

  const [progressSearchParams, setProgressSearchParams] =
    useState<CourseStudentsProgressQueryParams>({});

  const [quizSearchParams, setQuizSearchParams] = useState<CourseStudentsQuizResultsQueryParams>(
    {},
  );

  const [aiMentorSearchParams, setAiMentorSearchParams] =
    useState<CourseStudentsAiMentorResultsQueryParams>({});

  const [isPending, startTransition] = useTransition();

  const lessonCount = useMemo(
    () => course?.chapters?.reduce((acc, chapter) => acc + chapter.lessons.length, 0) || 0,
    [course],
  );

  const quizOptions = useMemo(() => {
    return (
      course?.chapters.flatMap((chapter) =>
        chapter.lessons
          .filter((lesson) => lesson.type === LessonType.QUIZ)
          .map((lesson) => ({ id: lesson.id, title: lesson.title })),
      ) || []
    );
  }, [course]);

  const aiMentorLessons = useMemo(() => {
    return (
      course?.chapters.flatMap((chapter) =>
        chapter.lessons
          .filter((lesson) => lesson.type === LessonType.AI_MENTOR)
          .map((lesson) => ({ id: lesson.id, title: lesson.title })),
      ) || []
    );
  }, [course]);

  const { data: courseStatistics } = useCourseStatistics({
    id,
    enabled: isAdminLike,
  });
  const { data: averageQuizScores } = useCourseAverageScorePerQuiz({ id, enabled: isAdminLike });

  const filterConfig: FilterConfig[] = [
    {
      name: "search",
      type: "text",
    },
  ];

  const handleFilterChange = <T,>(
    setter: React.Dispatch<React.SetStateAction<T>>,
    name: string,
    value: FilterValue,
  ) => {
    startTransition(() => {
      setter((prev) => {
        if ((name === "quizId" || name === "lessonId") && value === "all") {
          const { [name]: _, ...rest } = prev as Record<string, unknown>;
          return rest as T;
        }

        return {
          ...prev,
          [name]: value,
        } as T;
      });
    });
  };

  const handleProgressFilterChange = (name: string, value: FilterValue) => {
    handleFilterChange(setProgressSearchParams, name, value);
  };

  const handleQuizFilterChange = (name: string, value: FilterValue) => {
    handleFilterChange(setQuizSearchParams, name, value);
  };

  const handleAiMentorFilterChange = (name: string, value: FilterValue) => {
    handleFilterChange(setAiMentorSearchParams, name, value);
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <h6 className="h6">{t("adminCourseView.statistics.title")}</h6>
          <p className="body-base-md title-neutral-800">
            {t("adminCourseView.statistics.subtitle")}
          </p>
        </CardHeader>

        <CardContent className="flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 grid-rows-auto md:grid-rows-3">
            <CourseAdminStatisticsCard
              title={t("adminCourseView.statistics.overview.enrolledCount")}
              tooltipText={t("adminCourseView.statistics.overview.enrolledCountTooltip")}
              statistic={courseStatistics?.enrolledCount ?? 0}
            />
            <CourseAdminStatisticsCard
              title={t("adminCourseView.statistics.overview.completionRate")}
              tooltipText={t("adminCourseView.statistics.overview.completionRateTooltip")}
              statistic={courseStatistics?.completionPercentage ?? 0}
              type="percentage"
            />
            <CourseAdminStatisticsCard
              title={t("adminCourseView.statistics.overview.averageCompletionPercentage")}
              tooltipText={t(
                "adminCourseView.statistics.overview.averageCompletionPercentageTooltip",
              )}
              statistic={courseStatistics?.averageCompletionPercentage ?? 0}
              type="percentage"
            />
            <CourseStatusDistributionChart
              courseStatistics={courseStatistics}
              className="md:row-span-3 md:row-start-1 md:col-start-2"
            />
          </div>
          <AverageScorePerQuizChart averageQuizScores={averageQuizScores} />
          <Tabs value={activeTab} className="h-full">
            <div className="flex items-start md:items-center gap-2 flex-col md:flex-row">
              <h6 className="h6">{t("adminCourseView.statistics.details")}</h6>
              <div className="flex items-center justify-end gap-2 grow">
                {match(activeTab)
                  .with("progress", () => (
                    <div className="max-w-[248px]">
                      <SearchFilter
                        filters={filterConfig}
                        values={{ search: progressSearchParams.search }}
                        onChange={handleProgressFilterChange}
                        isLoading={isPending}
                        className="flex-nowrap"
                      />
                    </div>
                  ))
                  .with("quizResults", () => (
                    <Select
                      value={(quizSearchParams.quizId as string) || "all"}
                      onValueChange={(value) => handleQuizFilterChange("quizId", value)}
                    >
                      <SelectTrigger className="max-w-40 my-6">
                        <SelectValue placeholder={t("adminCourseView.statistics.filterByQuiz")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("adminCourseView.statistics.allQuizzes")}
                        </SelectItem>
                        {quizOptions.map((quiz) => (
                          <SelectItem key={quiz.id} value={quiz.id}>
                            {quiz.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ))
                  .with("aiMentorResults", () => (
                    <Select
                      value={(aiMentorSearchParams.lessonId as string) || "all"}
                      onValueChange={(value) => handleAiMentorFilterChange("lessonId", value)}
                    >
                      <SelectTrigger className="max-w-40 my-6">
                        <SelectValue placeholder={t("adminCourseView.statistics.filterByLesson")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("adminCourseView.statistics.allLessons")}
                        </SelectItem>
                        {aiMentorLessons.map((aiMentorLesson) => (
                          <SelectItem key={aiMentorLesson.id} value={aiMentorLesson.id}>
                            {aiMentorLesson.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ))
                  .exhaustive()}
                <TabsList className="h-[42px] rounded-sm p-1 bg-primary-50">
                  {Object.values(StatisticsTabs).map((tab) => (
                    <TabsTrigger
                      key={tab}
                      className="h-full"
                      value={tab}
                      onClick={() => setActiveTab(tab)}
                    >
                      {t(`adminCourseView.statistics.tabs.${tab}`)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </div>
            <TabsContent value="progress">
              <CourseStudentsProgressTable
                lessonCount={lessonCount}
                searchParams={progressSearchParams}
                onFilterChange={handleProgressFilterChange}
              />
            </TabsContent>
            <TabsContent value="quizResults">
              <CourseStudentsQuizResultsTable
                course={course}
                searchParams={quizSearchParams}
                onFilterChange={handleQuizFilterChange}
              />
            </TabsContent>
            <TabsContent value="aiMentorResults">
              <CourseStudentsAiMentorResultsTable
                searchParams={aiMentorSearchParams}
                onFilterChange={handleAiMentorFilterChange}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
