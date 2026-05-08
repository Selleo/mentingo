import { TabsList } from "@radix-ui/react-tabs";
import { PERMISSIONS } from "@repo/shared";
import { useMemo, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useCourseAverageScorePerQuiz } from "~/api/queries/admin/useCourseAverageScorePerQuiz";
import { useCourseStatisticsFilter } from "~/api/queries/admin/useCourseLearningTimeStatisticsFilterOptions";
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
import { usePermissions } from "~/hooks/usePermissions";
import { LessonType } from "~/modules/Admin/EditCourse/EditCourse.types";
import {
  SearchFilter,
  type FilterValue,
  type FilterConfig,
} from "~/modules/common/SearchFilter/SearchFilter";
import { CourseStudentsLearningTimeTable } from "~/modules/Courses/CourseView/CourseAdminStatistics/components/CourseStudentsLearningTimeTable";

import { COURSE_STATISTICS_HANDLES } from "../../../../../e2e/data/statistics/handles";

import {
  CourseAdminStatisticsCard,
  CourseStatusDistributionChart,
  AverageScorePerQuizChart,
  CourseStudentsProgressTable,
  CourseStudentsQuizResultsTable,
} from "./components";
import { CourseStudentsAiMentorResultsTable } from "./components/CourseStudentsAiMentorResults";

import type { GetCourseResponse } from "~/api/generated-api";
import type { CourseLearningTimeFilterQuery } from "~/api/queries/admin/useCourseLearningTimeStatistics";
import type { CourseStatisticsParams } from "~/api/queries/admin/useCourseStatistics";
import type { CourseStudentsAiMentorResultsQueryParams } from "~/api/queries/admin/useCourseStudentsAiMentorResults";
import type { CourseStudentsProgressQueryParams } from "~/api/queries/admin/useCourseStudentsProgress";
import type { CourseStudentsQuizResultsQueryParams } from "~/api/queries/admin/useCourseStudentsQuizResults";

const StatisticsTabs = {
  progress: "progress",
  quizResults: "quizResults",
  aiMentorResults: "aiMentorResults",
  learningTime: "learningTime",
} as const;

type AdminCourseStatisticsTab = (typeof StatisticsTabs)[keyof typeof StatisticsTabs];

interface CourseAdminStatisticsProps {
  course?: GetCourseResponse["data"];
}

export const formatLearningTime = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

export function CourseAdminStatistics({ course }: CourseAdminStatisticsProps) {
  const { t } = useTranslation();
  const courseId = course?.id || "";

  const { hasAccess: canManageCourses } = usePermissions({
    required: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
  });

  const [groupId, setGroupId] = useState<string | undefined>(undefined);

  const [courseStatisticsParams, setCourseStatisticsParams] = useState<CourseStatisticsParams>({});

  const [activeTab, setActiveTab] = useState<AdminCourseStatisticsTab>("progress");

  const [progressSearchParams, setProgressSearchParams] =
    useState<CourseStudentsProgressQueryParams>({});

  const [quizSearchParams, setQuizSearchParams] = useState<CourseStudentsQuizResultsQueryParams>(
    {},
  );

  const [learningTimeParams, setLearningTimeParams] = useState<CourseLearningTimeFilterQuery>({});

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

  const { data: learningTimeFilterOptions } = useCourseStatisticsFilter({
    id: courseId,
    enabled: canManageCourses,
  });

  const { data: courseStatistics } = useCourseStatistics({
    id: courseId,
    enabled: canManageCourses,
    query: courseStatisticsParams,
  });
  const { data: averageQuizScores } = useCourseAverageScorePerQuiz({
    id: courseId,
    enabled: canManageCourses,
    query: courseStatisticsParams,
  });

  const filterConfig: FilterConfig[] = [
    {
      name: "search",
      type: "text",
      testId: COURSE_STATISTICS_HANDLES.DETAILS_SEARCH_INPUT,
    },
  ];

  const timeFilterConfig: FilterConfig[] = [
    {
      name: "groupId",
      type: "select",
      options: learningTimeFilterOptions?.groups.map((group) => ({
        label: group.name,
        value: group.id,
      })),
      placeholder: t("adminCourseView.statistics.groupFilter.placeholder"),
      testId: COURSE_STATISTICS_HANDLES.GROUP_FILTER,
      optionTestId: (option) => COURSE_STATISTICS_HANDLES.groupFilterOption(option.value),
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

  const handleLearningTimeFilterChange = (name: string, value: FilterValue) => {
    handleFilterChange(setLearningTimeParams, name, value);
  };

  const handleGroupFilterChange = (_name: string, value: FilterValue) => {
    const nextGroupId = value as string | undefined;

    setGroupId(nextGroupId);
    startTransition(() => {
      const updateGroupId = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => {
        setter((prev) => {
          if (!nextGroupId) {
            const { groupId: _, ...rest } = prev as Record<string, unknown>;
            return rest as T;
          }

          return {
            ...prev,
            groupId: nextGroupId,
          } as T;
        });
      };

      updateGroupId(setCourseStatisticsParams);
      updateGroupId(setProgressSearchParams);
      updateGroupId(setQuizSearchParams);
      updateGroupId(setLearningTimeParams);
      updateGroupId(setAiMentorSearchParams);
    });
  };

  const getSearchValue = () => {
    switch (activeTab) {
      case "progress":
        return progressSearchParams.search;
      case "quizResults":
        return quizSearchParams.search;
      case "aiMentorResults":
        return aiMentorSearchParams.search;
      case "learningTime":
        return learningTimeParams.search;
      default:
        return undefined;
    }
  };

  const handleTabSearchChange = (name: string, value: FilterValue) => {
    switch (activeTab) {
      case "progress":
        handleProgressFilterChange(name, value);
        break;
      case "quizResults":
        handleQuizFilterChange(name, value);
        break;
      case "aiMentorResults":
        handleAiMentorFilterChange(name, value);
        break;
      case "learningTime":
        handleLearningTimeFilterChange(name, value);
        break;
    }
  };

  return (
    <TooltipProvider>
      <Card data-testid={COURSE_STATISTICS_HANDLES.ROOT}>
        <CardHeader>
          <h6 className="h6">{t("adminCourseView.statistics.title")}</h6>
          <p className="body-base-md title-neutral-800">
            {t("adminCourseView.statistics.subtitle")}
          </p>
        </CardHeader>

        <CardContent className="flex flex-col gap-8">
          <div>
            <SearchFilter
              filters={timeFilterConfig}
              values={{
                groupId,
              }}
              onChange={handleGroupFilterChange}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 grid-rows-auto md:grid-rows-4">
            <CourseAdminStatisticsCard
              data-testid={COURSE_STATISTICS_HANDLES.OVERVIEW_ENROLLED_COUNT_CARD}
              title={t("adminCourseView.statistics.overview.enrolledCount")}
              tooltipText={t("adminCourseView.statistics.overview.enrolledCountTooltip")}
              statistic={courseStatistics?.enrolledCount ?? 0}
            />
            <CourseAdminStatisticsCard
              data-testid={COURSE_STATISTICS_HANDLES.OVERVIEW_COMPLETION_RATE_CARD}
              title={t("adminCourseView.statistics.overview.completionRate")}
              tooltipText={t("adminCourseView.statistics.overview.completionRateTooltip")}
              statistic={courseStatistics?.completionPercentage ?? 0}
              type="percentage"
            />
            <CourseAdminStatisticsCard
              data-testid={COURSE_STATISTICS_HANDLES.OVERVIEW_AVERAGE_COMPLETION_CARD}
              title={t("adminCourseView.statistics.overview.averageCompletionPercentage")}
              tooltipText={t(
                "adminCourseView.statistics.overview.averageCompletionPercentageTooltip",
              )}
              statistic={courseStatistics?.averageCompletionPercentage ?? 0}
              type="percentage"
            />
            <CourseAdminStatisticsCard
              data-testid={COURSE_STATISTICS_HANDLES.OVERVIEW_AVERAGE_LEARNING_TIME_CARD}
              title={t("adminCourseView.statistics.overview.averageLearningTime")}
              tooltipText={t("adminCourseView.statistics.overview.averageLearningTimeTooltip")}
              statistic={formatLearningTime(courseStatistics?.averageSeconds ?? 0)}
              type="text"
            />
            <CourseStatusDistributionChart
              courseStatistics={courseStatistics}
              className="md:row-span-4 md:row-start-1 md:col-start-2"
            />
          </div>
          <AverageScorePerQuizChart averageQuizScores={averageQuizScores} />
          <Tabs value={activeTab} className="h-full">
            <div className="flex items-start gap-2 flex-col pb-6">
              <h6 className="h6">{t("adminCourseView.statistics.details")}</h6>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 w-full">
                <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto">
                  <div className="max-w-[248px] min-w-52 shrink-0">
                    <SearchFilter
                      filters={filterConfig}
                      values={{ search: getSearchValue() }}
                      onChange={handleTabSearchChange}
                      isLoading={isPending}
                      className="flex-nowrap py-0"
                      key={activeTab}
                    />
                  </div>

                  {match(activeTab)
                    .with("quizResults", () => (
                      <Select
                        value={(quizSearchParams.quizId as string) || "all"}
                        onValueChange={(value) => handleQuizFilterChange("quizId", value)}
                      >
                        <SelectTrigger
                          data-testid={COURSE_STATISTICS_HANDLES.QUIZ_FILTER}
                          className="max-w-52"
                        >
                          <SelectValue placeholder={t("adminCourseView.statistics.filterByQuiz")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            data-testid={COURSE_STATISTICS_HANDLES.quizFilterOption("all")}
                            value="all"
                          >
                            {t("adminCourseView.statistics.allQuizzes")}
                          </SelectItem>
                          {quizOptions.map((quiz) => (
                            <SelectItem
                              key={quiz.id}
                              data-testid={COURSE_STATISTICS_HANDLES.quizFilterOption(quiz.id)}
                              value={quiz.id}
                            >
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
                        <SelectTrigger
                          data-testid={COURSE_STATISTICS_HANDLES.AI_MENTOR_LESSON_FILTER}
                          className="max-w-52"
                        >
                          <SelectValue
                            placeholder={t("adminCourseView.statistics.filterByLesson")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            data-testid={COURSE_STATISTICS_HANDLES.aiMentorLessonFilterOption(
                              "all",
                            )}
                            value="all"
                          >
                            {t("adminCourseView.statistics.allLessons")}
                          </SelectItem>
                          {aiMentorLessons.map((aiMentorLesson) => (
                            <SelectItem
                              key={aiMentorLesson.id}
                              data-testid={COURSE_STATISTICS_HANDLES.aiMentorLessonFilterOption(
                                aiMentorLesson.id,
                              )}
                              value={aiMentorLesson.id}
                            >
                              {aiMentorLesson.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ))
                    .otherwise(() => null)}
                </div>
                <TabsList className="h-[42px] rounded-sm p-1 bg-primary-50 flex items-center">
                  {Object.values(StatisticsTabs).map((tab) => (
                    <TabsTrigger
                      key={tab}
                      data-testid={
                        {
                          progress: COURSE_STATISTICS_HANDLES.PROGRESS_TAB,
                          quizResults: COURSE_STATISTICS_HANDLES.QUIZ_RESULTS_TAB,
                          aiMentorResults: COURSE_STATISTICS_HANDLES.AI_MENTOR_RESULTS_TAB,
                          learningTime: COURSE_STATISTICS_HANDLES.LEARNING_TIME_TAB,
                        }[tab]
                      }
                      className="h-full grow md:w-fit"
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
                courseId={courseId}
                lessonCount={lessonCount}
                searchParams={progressSearchParams}
                onFilterChange={handleProgressFilterChange}
              />
            </TabsContent>
            <TabsContent value="quizResults">
              <CourseStudentsQuizResultsTable
                courseId={courseId}
                course={course}
                searchParams={quizSearchParams}
                onFilterChange={handleQuizFilterChange}
              />
            </TabsContent>
            <TabsContent value="aiMentorResults">
              <CourseStudentsAiMentorResultsTable
                courseId={courseId}
                course={course}
                searchParams={aiMentorSearchParams}
                onFilterChange={handleAiMentorFilterChange}
              />
            </TabsContent>
            <TabsContent value="learningTime">
              <CourseStudentsLearningTimeTable
                courseId={courseId}
                searchParams={learningTimeParams}
                onFilterChange={handleLearningTimeFilterChange}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
