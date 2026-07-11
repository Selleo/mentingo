import { useNavigate } from "@remix-run/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useToggleCourseStudentMode } from "~/api/mutations";
import { useCourseStatistics } from "~/api/queries/admin/useCourseStatistics";

import { useCourseAccessProvider } from "../../context/CourseAccessProvider";

import ChapterList from "./ChapterList";
import CourseStatisticsPanel from "./CourseStatisticsPanel";
import TableOfContentTabs, { type TableOfContentTab } from "./TableOfContentTabs";

export function TableOfContent() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { course, isAdminExperience } = useCourseAccessProvider();

  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TableOfContentTab>("toc");
  const [expandedChapters, setExpandedChapters] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [showAllChapters, setShowAllChapters] = useState(false);

  const { mutate: toggleLearningMode } = useToggleCourseStudentMode(course.id);
  const { data: courseStatistics, isLoading: isLoadingCourseStatistics } = useCourseStatistics({
    id: course.id,
    enabled: isAdminExperience && activeTab === "statistics",
    query: {},
  });

  const toggleChapter = (id: string) => {
    setExpandedChapters((prev) =>
      prev.includes(id) ? prev.filter((chapterId) => chapterId !== id) : [...prev, id],
    );
  };

  const expandCompletedChapters = () => {
    setCompletedExpanded(true);
  };

  const showAllCourseChapters = () => {
    setShowAllChapters(true);
  };

  const navigateToCourseEditor = () => {
    navigate(`/admin/beta-courses/${course.id}`);
  };

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
    <div data-section="toc" className="rounded-2xl bg-white p-4 shadow-lg md:p-6">
      {isAdminExperience && (
        <TableOfContentTabs
          activeTab={activeTab}
          onEditContent={navigateToCourseEditor}
          onTabChange={setActiveTab}
        />
      )}

      {!isAdminExperience && !isMobile && (
        <div className="mb-4 md:mb-6">
          <h2 className="font-gothic text-xl font-bold text-neutral-950 md:text-2xl">
            {t("modernCourseView.contents.title")}
          </h2>
        </div>
      )}

      {(!isAdminExperience || activeTab === "toc") && (
        <ChapterList
          completedExpanded={completedExpanded}
          expandedChapters={expandedChapters}
          isMobile={isMobile}
          onExpandCompleted={expandCompletedChapters}
          onShowAllChapters={showAllCourseChapters}
          onToggleChapter={toggleChapter}
          showAllChapters={showAllChapters}
        />
      )}

      {isAdminExperience && activeTab === "statistics" && (
        <CourseStatisticsPanel
          courseStatistics={courseStatistics}
          isLoading={isLoadingCourseStatistics}
        />
      )}
    </div>
  );
}
