import { useNavigate } from "@remix-run/react";
import { PERMISSIONS, type SupportedLanguages } from "@repo/shared";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUser } from "~/api/queries";
import { useMissingTranslations } from "~/api/queries/admin/useHasMissingTranslations";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { canManageCourseByAuthor, hasPermission } from "~/common/permissions/permission.utils";

import { useCourseAccessProvider } from "../../context/CourseAccessProvider";
import { CourseAdminStatistics } from "../CourseAdminStatistics/CourseAdminStatistics";
import { CourseChatTab } from "../CourseChat/CourseChatTab";

import ChapterList from "./ChapterList";
import CourseOverviewTabs, {
  COURSE_OVERVIEW_TABS,
  type CourseOverviewTab,
} from "./CourseOverviewTabs";

type TableOfContentProps = {
  language: SupportedLanguages;
};

export function TableOfContent({ language }: TableOfContentProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { course, isAdminExperience, isCourseStudentModeActive } = useCourseAccessProvider();
  const { data: currentUser } = useCurrentUser();
  const { data: globalSettings } = useGlobalSettings();
  const { data: missingTranslationsResponse } = useMissingTranslations(
    course.id,
    language,
    isAdminExperience,
  );

  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<CourseOverviewTab>(COURSE_OVERVIEW_TABS.TOC);
  const [expandedChapters, setExpandedChapters] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [showAllChapters, setShowAllChapters] = useState(false);

  const permissions = currentUser?.permissions ?? [];
  const canManageCourse = canManageCourseByAuthor({
    permissions,
    courseAuthorId: course.authorId,
    currentUserId: currentUser?.id,
  });
  const canShowChat = Boolean(
    globalSettings?.courseDiscussionsEnabled &&
      course.enrolled &&
      currentUser &&
      hasPermission(permissions, PERMISSIONS.COURSE_DISCUSSION_READ),
  );

  const canDeleteAnyMessage = hasPermission(
    permissions,
    PERMISSIONS.COURSE_DISCUSSION_MESSAGE_DELETE,
  );
  const canShowStatistics =
    !isCourseStudentModeActive &&
    canManageCourse &&
    hasPermission(permissions, PERMISSIONS.COURSE_STATISTICS);
  const shouldShowTabs = isAdminExperience || canShowChat || canShowStatistics;
  const hasMissingTranslations = missingTranslationsResponse?.data.hasMissingTranslations ?? false;

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
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!canShowStatistics && activeTab === COURSE_OVERVIEW_TABS.STATISTICS) {
      setActiveTab(COURSE_OVERVIEW_TABS.TOC);
    }
  }, [activeTab, canShowStatistics]);

  return (
    <div data-section="toc" className="rounded-2xl bg-white p-4 shadow-lg md:p-6">
      {shouldShowTabs && (
        <CourseOverviewTabs
          activeTab={activeTab}
          canEditContent={isAdminExperience}
          canShowChat={canShowChat}
          canShowStatistics={canShowStatistics}
          hasMissingTranslations={hasMissingTranslations}
          onEditContent={navigateToCourseEditor}
          onTabChange={setActiveTab}
        />
      )}

      {!shouldShowTabs && (
        <div className="mb-4 md:mb-6">
          <h2 className="font-gothic text-xl font-bold text-neutral-950 md:text-2xl">
            {t("modernCourseView.contents.title")}
          </h2>
        </div>
      )}

      {activeTab === COURSE_OVERVIEW_TABS.TOC && (
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

      {canShowStatistics && activeTab === COURSE_OVERVIEW_TABS.STATISTICS && (
        <CourseAdminStatistics course={course} canManageCourse={canManageCourse} />
      )}

      {canShowChat && activeTab === COURSE_OVERVIEW_TABS.CHAT && currentUser && (
        <CourseChatTab
          courseId={course.id}
          currentUserId={currentUser.id}
          canDeleteAnyMessage={canDeleteAnyMessage}
        />
      )}
    </div>
  );
}
