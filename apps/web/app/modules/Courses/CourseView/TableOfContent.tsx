import { useNavigate } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useToggleCourseStudentMode } from "~/api/mutations";
import { useCurrentUser } from "~/api/queries";
import { useCourseStatistics } from "~/api/queries/admin/useCourseStatistics";
import { usePermissions } from "~/hooks/usePermissions";

import { useCourseAccessProvider } from "../context/CourseAccessProvider";

import ChapterList from "./TableOfContent/ChapterList";
import CourseStatisticsPanel from "./TableOfContent/CourseStatisticsPanel";
import TableOfContentTabs, { type TableOfContentTab } from "./TableOfContent/TableOfContentTabs";

import type { GetCourseResponse } from "~/api/generated-api";

type CourseHeroProps = {
  course: GetCourseResponse["data"];
};

export function TableOfContent({ course }: CourseHeroProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TableOfContentTab>("toc");
  const [expandedChapters, setExpandedChapters] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [showAllChapters, setShowAllChapters] = useState(false);

  const { data: currentUser } = useCurrentUser();
  const { hasAccess: canManageUsers } = usePermissions({
    required: PERMISSIONS.USER_MANAGE,
  });
  const { hasAccess: canManageCourses } = usePermissions({
    required: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
  });
  const { isCourseStudentModeActive } = useCourseAccessProvider();
  const { mutate: toggleLearningMode } = useToggleCourseStudentMode(course.id);
  const canEditCourse = canManageUsers || (canManageCourses && course.authorId === currentUser?.id);
  const isAdminExperience = canEditCourse && !isCourseStudentModeActive;
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
          onEditContent={() => navigate(`/admin/beta-courses/${course.id}`)}
          onTabChange={setActiveTab}
        />
      )}

      {!isAdminExperience && !isMobile && (
        <div className="mb-4 md:mb-6">
          <h2 className="font-gothic text-xl font-bold text-[#363636] md:text-2xl">
            {t("modernCourseView.contents.title")}
          </h2>
        </div>
      )}

      {(!isAdminExperience || activeTab === "toc") && (
        <ChapterList
          completedExpanded={completedExpanded}
          course={course}
          expandedChapters={expandedChapters}
          isAdminExperience={isAdminExperience}
          isMobile={isMobile}
          onExpandCompleted={() => setCompletedExpanded(true)}
          onShowAllChapters={() => setShowAllChapters(true)}
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
