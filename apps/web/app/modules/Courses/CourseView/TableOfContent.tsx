import { useNavigate } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import {
  BarChart2,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  Edit2,
  HelpCircle,
  Minus,
  MonitorPlay,
  Play,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useToggleCourseStudentMode } from "~/api/mutations";
import { useCurrentUser } from "~/api/queries";
import { useCourseStatistics } from "~/api/queries/admin/useCourseStatistics";
import { usePermissions } from "~/hooks/usePermissions";
import { formatDuration } from "~/modules/Courses/utils/formatDuration";

import { useCourseAccessProvider } from "../context/CourseAccessProvider";

import type { TFunction } from "i18next";
import type { GetCourseResponse } from "~/api/generated-api";

type CourseHeroProps = {
  course: GetCourseResponse["data"];
};

type CourseLesson = GetCourseResponse["data"]["chapters"][number]["lessons"][number];

function getLessonStatus(status: string, t: TFunction) {
  switch (status) {
    case "completed":
      return (
        <div className="relative group/status">
          <CheckCircle2 className="w-5 h-5 text-[#26b183]" />
          <div className="absolute right-0 bottom-full mb-2 px-2 py-1 bg-[#363636] text-white text-xs rounded opacity-0 group-hover/status:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            {t("modernCourseView.contents.status.completed")}
          </div>
        </div>
      );
    case "in-progress":
      return (
        <div className="relative group/status">
          <Circle className="w-4 h-4 fill-current text-[#D4705D]" />
          <div className="absolute right-0 bottom-full mb-2 px-2 py-1 bg-[#363636] text-white text-xs rounded opacity-0 group-hover/status:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            {t("modernCourseView.contents.status.inProgress")}
          </div>
        </div>
      );
    case "not-started":
      return (
        <div className="relative group/status">
          <Minus className="w-5 h-5 text-[#676767]" />
          <div className="absolute right-0 bottom-full mb-2 px-2 py-1 bg-[#363636] text-white text-xs rounded opacity-0 group-hover/status:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            {t("modernCourseView.contents.status.notStarted")}
          </div>
        </div>
      );
    default:
      return null;
  }
}

function getLessonIcon(type: string, t: TFunction) {
  const iconMap = {
    video: {
      icon: <MonitorPlay className="w-4 h-4 text-[#3f58b6]" />,
      label: t("modernCourseView.contents.lessonTypes.content"),
    },
    quiz: {
      icon: <HelpCircle className="w-4 h-4 text-[#3f58b6]" />,
      label: t("modernCourseView.contents.lessonTypes.quiz"),
    },
    "ai-mentor": {
      icon: <Sparkles className="w-4 h-4 text-[#3f58b6]" />,
      label: t("modernCourseView.contents.lessonTypes.aiMentor"),
    },
  };

  const { icon, label } = iconMap[type as keyof typeof iconMap] || {
    icon: <Play className="w-4 h-4 text-[#3f58b6]" />,
    label: t("modernCourseView.contents.lessonTypes.lesson"),
  };

  return (
    <div className="relative group/icon">
      {icon}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-[#363636] text-white text-xs rounded opacity-0 group-hover/icon:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
        {label}
      </div>
    </div>
  );
}

export function TableOfContent({ course }: CourseHeroProps) {
  const navigate = useNavigate();

  const { t } = useTranslation();
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"toc" | "statistics">("toc");
  const [expandedChapters, setExpandedChapters] = useState<number[]>([]);

  const toggleChapter = (id: number) => {
    setExpandedChapters((prev) =>
      prev.includes(id) ? prev.filter((cId) => cId !== id) : [...prev, id],
    );
  };

  const { data: currentUser } = useCurrentUser();

  const { hasAccess: canManageUsers } = usePermissions({
    required: PERMISSIONS.USER_MANAGE,
  });

  const { hasAccess: canManageCourses } = usePermissions({
    required: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
  });
  const { isCourseStudentModeActive } = useCourseAccessProvider();
  const canEditCourse = canManageUsers || (canManageCourses && course.authorId === currentUser?.id);
  const { mutate: toggleLearningMode } = useToggleCourseStudentMode(course.id);
  const isAdminExperience = canEditCourse && !isCourseStudentModeActive;
  const { data: courseStatistics, isLoading: isLoadingCourseStatistics } = useCourseStatistics({
    id: course.id,
    enabled: isAdminExperience && activeTab === "statistics",
    query: {},
  });

  const [isMobile, setIsMobile] = useState(false);
  const [showAllChapters, setShowAllChapters] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        toggleLearningMode({ enabled: true });
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [toggleLearningMode]);

  return (
    <div data-section="toc" className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
      {/* Tabs with Edit Button - Only in Admin Mode */}
      {isAdminExperience && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[#e5e5e5] mb-4 md:mb-6 gap-3">
          <div className="flex items-center gap-4 md:gap-6 overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => setActiveTab("toc")}
              className={`pb-3 px-1 font-semibold text-sm transition-colors relative whitespace-nowrap ${
                activeTab === "toc" ? "text-[#3f58b6]" : "text-[#676767] hover:text-[#363636]"
              }`}
            >
              {t("modernCourseView.contents.title")}
              {activeTab === "toc" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3f58b6]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("statistics")}
              className={`pb-3 px-1 font-semibold text-sm transition-colors relative whitespace-nowrap ${
                activeTab === "statistics"
                  ? "text-[#3f58b6]"
                  : "text-[#676767] hover:text-[#363636]"
              }`}
            >
              {t("modernCourseView.contents.statistics")}
              {activeTab === "statistics" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3f58b6]" />
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/admin/beta-courses/${course.id}`)}
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-[#3f58b6] text-white rounded-lg hover:bg-[#324a95] transition-colors mb-3 whitespace-nowrap"
          >
            <Edit2 className="w-4 h-4" />
            <span className="text-sm font-semibold">{t("modernCourseView.contents.edit")}</span>
          </button>
        </div>
      )}

      {/* Header for Learning Mode */}
      {!isAdminExperience && !isMobile && (
        <div className="mb-4 md:mb-6">
          <h2 className="font-gothic text-xl font-bold text-[#363636] md:text-2xl">
            {t("modernCourseView.contents.title")}
          </h2>
        </div>
      )}

      {/* Table of Contents Content */}
      {(!isAdminExperience || activeTab === "toc") && (
        <div className="relative">
          {/* Vertical Line - Desktop only */}
          <div className="hidden md:block absolute left-[24px] md:left-[20px] top-2 bottom-2 w-0.5 bg-[#e5e5e5]" />

          {/* Chapters */}
          <div className="space-y-4">
            {/* Completed Chapters - Collapsed/Expanded */}
            {!isAdminExperience &&
              course.chapters.filter((ch) => ch.chapterProgress === "completed").length > 0 &&
              !completedExpanded && (
                <div className="relative">
                  <div className="flex gap-4">
                    <div className="hidden md:flex relative z-10 w-12 h-12 md:w-10 md:h-10 rounded-full items-center justify-center flex-shrink-0 border-2 bg-[#26b183] border-[#26b183]">
                      <Check className="w-6 h-6 md:w-5 md:h-5 text-white" />
                    </div>

                    <div className="flex-1 pb-2">
                      <button
                        type="button"
                        onClick={() => setCompletedExpanded(true)}
                        className="group w-full cursor-pointer rounded-xl p-5 text-left md:p-4 transition-all bg-green-50/50 hover:bg-green-50 active:bg-green-50"
                      >
                        <div className="flex items-center gap-3">
                          <ChevronDown className="w-5 h-5 md:w-4 md:h-4 text-[#26b183] flex-shrink-0" />
                          <h3 className="font-semibold text-base md:text-sm text-[#26b183] leading-tight">
                            {t("modernCourseView.contents.completedChapters", {
                              count: course.chapters.filter(
                                (chapter) => chapter.chapterProgress === "completed",
                              ).length,
                            })}
                          </h3>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}

            {/* Expanded Completed Chapters */}
            {!isAdminExperience &&
              completedExpanded &&
              course.chapters
                .filter((ch) => ch.chapterProgress === "completed")
                .map((chapter) => {
                  const isExpanded = expandedChapters.includes(chapter.id);
                  return (
                    <div key={chapter.id} className="relative">
                      <div className="flex gap-4">
                        <div className="hidden md:flex relative z-10 w-12 h-12 md:w-10 md:h-10 rounded-full items-center justify-center flex-shrink-0 border-2 bg-[#26b183] border-[#26b183]">
                          <Check className="w-6 h-6 md:w-5 md:h-5 text-white" />
                        </div>

                        <div className="flex-1 pb-2">
                          <button
                            type="button"
                            onClick={() => toggleChapter(chapter.id)}
                            className="group w-full cursor-pointer rounded-xl p-5 text-left md:p-4 transition-all bg-green-50/50 hover:bg-green-50"
                          >
                            <div className="flex items-center gap-3 mb-2">
                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5 md:w-4 md:h-4 text-[#26b183] flex-shrink-0" />
                              ) : (
                                <ChevronDown className="w-5 h-5 md:w-4 md:h-4 text-[#26b183] flex-shrink-0" />
                              )}
                              <h3 className="font-semibold text-base md:text-sm text-[#26b183] leading-tight flex-1">
                                {chapter.title}
                              </h3>
                              <span className="text-sm md:text-xs text-[#676767] whitespace-nowrap flex-shrink-0">
                                {formatDuration(chapter.estimatedDurationSeconds)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-[#676767] ml-7">
                              <span className="flex items-center gap-1">
                                <BookOpen className="w-3.5 h-3.5" />
                                {t("modernCourseView.contents.lessons", {
                                  count: chapter.lessonCount,
                                })}
                              </span>
                            </div>
                          </button>

                          {/* Expanded Lessons */}
                          {isExpanded && chapter.lessons && (
                            <div className="mt-3 ml-7">
                              {chapter.lessons.map((lesson: CourseLesson, lessonIndex: number) => (
                                <div key={lesson.id}>
                                  <div className="flex items-center gap-3 py-4 md:py-3 hover:bg-green-50/30 transition-all cursor-pointer group/lesson">
                                    <div className="w-10 h-10 md:w-8 md:h-8 rounded-lg flex items-center justify-center flex-shrink-0">
                                      {getLessonIcon(lesson.type, t)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-base md:text-sm font-medium text-[#363636] group-hover/lesson:text-[#3f58b6] transition-colors leading-relaxed">
                                        {lesson.title}
                                      </p>
                                    </div>
                                    {!isAdminExperience && getLessonStatus(lesson.status, t)}
                                  </div>
                                  {lessonIndex < chapter.lessons.length - 1 && (
                                    <div className="border-t border-[#e5e5e5] ml-12 md:ml-11" />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Connecting Line - Desktop only */}
                      <div className="hidden md:block absolute left-[24px] md:left-[20px] top-12 md:top-10 w-0.5 h-[calc(100%+16px)] bg-[#e5e5e5] -z-10" />
                    </div>
                  );
                })}

            {/* Current and Locked Chapters */}
            {course.chapters
              .filter((ch) => isAdminExperience || ch.chapterProgress !== "completed")
              .filter((ch, idx, arr) => {
                // On mobile in learning mode, only show current and next chapter by default
                if (isMobile && !isAdminExperience && !showAllChapters) {
                  const currentIndex = arr.findIndex((c) => c.chapterProgress === "in_progress");
                  const chapterIndex = arr.indexOf(ch);
                  return chapterIndex >= currentIndex && chapterIndex <= currentIndex + 1;
                }
                return true;
              })
              .map((chapter) => {
                const isExpanded = expandedChapters.includes(chapter.id);
                const isCompleted = !isAdminExperience && chapter.chapterProgress === "completed";
                const isCurrent = !isAdminExperience && chapter.chapterProgress === "in_progress";
                const chapterNumber = course.chapters.indexOf(chapter) + 1;

                return (
                  <div key={chapter.id} className="relative">
                    {/* Chapter */}
                    <div className="flex gap-4">
                      {/* Number/Status Circle - Desktop only */}
                      <div
                        className={`hidden md:flex relative z-10 w-12 h-12 md:w-10 md:h-10 rounded-full items-center justify-center flex-shrink-0 border-2 ${
                          isCompleted
                            ? "bg-[#26b183] border-[#26b183]"
                            : isCurrent
                              ? "bg-[#3f58b6] border-[#3f58b6]"
                              : "bg-white border-[#e5e5e5]"
                        }`}
                      >
                        {isCompleted ? (
                          <Check className="w-6 h-6 md:w-5 md:h-5 text-white" />
                        ) : isCurrent ? (
                          <span className="text-base md:text-sm font-bold text-white">
                            {chapterNumber}
                          </span>
                        ) : (
                          <span
                            className={`text-base md:text-sm font-bold ${isAdminExperience ? "text-[#676767]" : "text-[#b0b0b0]"}`}
                          >
                            {chapterNumber}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 pb-2">
                        {/* Header */}
                        <button
                          type="button"
                          onClick={() => toggleChapter(chapter.id)}
                          className={`group w-full cursor-pointer rounded-xl p-5 text-left md:p-4 transition-all ${
                            isCompleted
                              ? "bg-green-50/50 hover:bg-green-50"
                              : isCurrent
                                ? "bg-blue-50/50 hover:bg-blue-50"
                                : "bg-gray-50/50 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            {isExpanded ? (
                              <ChevronUp
                                className={`w-5 h-5 md:w-4 md:h-4 flex-shrink-0 ${
                                  isCompleted
                                    ? "text-[#26b183]"
                                    : isCurrent
                                      ? "text-[#3f58b6]"
                                      : "text-[#676767]"
                                }`}
                              />
                            ) : (
                              <ChevronDown
                                className={`w-5 h-5 md:w-4 md:h-4 flex-shrink-0 ${
                                  isCompleted
                                    ? "text-[#26b183]"
                                    : isCurrent
                                      ? "text-[#3f58b6]"
                                      : "text-[#676767]"
                                }`}
                              />
                            )}
                            <h3
                              className={`font-semibold text-base md:text-sm leading-tight flex-1 ${
                                isCompleted
                                  ? "text-[#26b183]"
                                  : isCurrent
                                    ? "text-[#3f58b6]"
                                    : "text-[#676767]"
                              }`}
                            >
                              {chapter.title}
                            </h3>
                            <span className="text-sm md:text-xs text-[#676767] whitespace-nowrap flex-shrink-0">
                              {formatDuration(chapter.estimatedDurationSeconds)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between ml-7">
                            <div className="flex items-center gap-3 text-xs text-[#676767]">
                              <span className="flex items-center gap-1">
                                <BookOpen className="w-3.5 h-3.5" />
                                {t("modernCourseView.contents.lessons", {
                                  count: chapter.lessonCount,
                                })}
                              </span>
                            </div>

                            {isCurrent && (
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 text-xs text-[#3f58b6] font-semibold">
                                  <span>
                                    {chapter.progress}/{chapter.total}
                                  </span>
                                </div>
                                <div className="flex gap-0.5 w-32">
                                  {Array.from({
                                    length: chapter.total,
                                  }).map((_, idx) => (
                                    <div
                                      key={idx}
                                      className={`h-2 rounded-full flex-1 transition-all ${
                                        idx < chapter.progress ? "bg-[#3f58b6]" : "bg-[#e1eaf8]"
                                      }`}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </button>

                        {/* Expanded Lessons */}
                        {isExpanded && chapter.lessons && (
                          <div className="mt-3 ml-7">
                            {chapter.lessons.map((lesson: CourseLesson, lessonIndex: number) => (
                              <div key={lesson.id}>
                                <div
                                  className={`flex items-center gap-3 py-4 md:py-3 transition-all cursor-pointer group/lesson ${
                                    isCompleted
                                      ? "hover:bg-green-50/30"
                                      : isCurrent
                                        ? "hover:bg-blue-50/30"
                                        : "hover:bg-gray-50/30"
                                  }`}
                                >
                                  <div className="w-10 h-10 md:w-8 md:h-8 rounded-lg flex items-center justify-center flex-shrink-0">
                                    {getLessonIcon(lesson.type, t)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-base md:text-sm font-medium text-[#363636] group-hover/lesson:text-[#3f58b6] transition-colors leading-relaxed">
                                      {lesson.title}
                                    </p>
                                  </div>
                                  {!isAdminExperience && getLessonStatus(lesson.status, t)}
                                </div>
                                {lessonIndex < chapter.lessons.length - 1 && (
                                  <div className="border-t border-[#e5e5e5] ml-12 md:ml-11" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

            {/* Show All Chapters Button - Mobile Only */}
            {isMobile &&
              !isAdminExperience &&
              !showAllChapters &&
              course.chapters.filter((ch) => ch.chapterProgress !== "completed").length > 2 && (
                <div className="relative mt-6">
                  <button
                    onClick={() => setShowAllChapters(true)}
                    className="w-full bg-gray-50 hover:bg-gray-100 text-[#3f58b6] font-semibold py-4 px-6 rounded-xl border-2 border-dashed border-gray-300 hover:border-[#3f58b6] transition-all flex items-center justify-center gap-2"
                  >
                    <ChevronDown className="w-5 h-5" />
                    {t("modernCourseView.contents.showAllChapters", {
                      count:
                        course.chapters.filter((chapter) => chapter.chapterProgress !== "completed")
                          .length - 2,
                    })}
                  </button>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Statistics Content */}
      {isAdminExperience && activeTab === "statistics" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-gothic text-xl font-bold text-[#363636]">
                {t("modernCourseView.contents.courseStatistics")}
              </h3>
              <p className="text-sm text-[#676767] mt-1">
                {t("modernCourseView.contents.statisticsDescription")}
              </p>
            </div>
          </div>

          {/* Placeholder Stats Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-[#3f58b6]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#363636]">
                    {isLoadingCourseStatistics
                      ? "—"
                      : (courseStatistics?.enrolledCount ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-[#676767]">
                    {t("modernCourseView.contents.totalStudents")}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-xl p-4 border border-green-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-[#26b183]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#363636]">
                    {isLoadingCourseStatistics
                      ? "—"
                      : `${Math.round(courseStatistics?.completionPercentage ?? 0)}%`}
                  </p>
                  <p className="text-xs text-[#676767]">
                    {t("modernCourseView.contents.completionRate")}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#363636]">
                    {isLoadingCourseStatistics
                      ? "—"
                      : formatDuration(courseStatistics?.averageSeconds ?? 0)}
                  </p>
                  <p className="text-xs text-[#676767]">
                    {t("modernCourseView.contents.averageTime")}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
              <div className="mb-2 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-orange-100">
                  <BarChart2 className="size-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#363636]">4.7</p>
                  <p className="text-xs text-[#676767]">
                    {t("modernCourseView.contents.averageRating")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Placeholder Chart */}
          <div className="bg-gray-50 rounded-xl p-8 border-2 border-dashed border-gray-300">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart2 className="w-8 h-8 text-gray-400" />
              </div>
              <h4 className="text-lg font-semibold text-[#363636] mb-2">
                {t("modernCourseView.contents.detailedStatisticsSoon")}
              </h4>
              <p className="text-sm text-[#676767] max-w-md mx-auto">
                {t("modernCourseView.contents.detailedStatisticsDescription")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
