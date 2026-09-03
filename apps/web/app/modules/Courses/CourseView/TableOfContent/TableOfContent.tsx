import { useNavigate } from "@remix-run/react";
import { COURSE_ORIGIN_TYPES, PERMISSIONS, type SupportedLanguages } from "@repo/shared";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUser } from "~/api/queries";
import { useMissingTranslations } from "~/api/queries/admin/useHasMissingTranslations";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { canManageCourseByAuthor, hasPermission } from "~/common/permissions/permission.utils";
import { ChapterListOverview } from "~/modules/Courses/CourseView/components/ChapterListOverview";

import { useCourseAccessProvider } from "../../context/CourseAccessProvider";
import { CourseAdminStatistics } from "../CourseAdminStatistics/CourseAdminStatistics";
import { CourseChatTab } from "../CourseChat/CourseChatTab";

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

  const [activeTab, setActiveTab] = useState<CourseOverviewTab>(COURSE_OVERVIEW_TABS.TOC);

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
  const canEditContent = isAdminExperience && course.originType !== COURSE_ORIGIN_TYPES.EXPORTED;

  const navigateToCourseEditor = () => {
    navigate(`/admin/beta-courses/${course.id}`);
  };

  useEffect(() => {
    if (!canShowStatistics && activeTab === COURSE_OVERVIEW_TABS.STATISTICS) {
      setActiveTab(COURSE_OVERVIEW_TABS.TOC);
    }
  }, [activeTab, canShowStatistics]);

  return (
    <div data-section="toc" className="rounded-2xl bg-white p-4 shadow-sm md:p-6">
      {shouldShowTabs && (
        <CourseOverviewTabs
          activeTab={activeTab}
          canEditContent={canEditContent}
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

      {activeTab === COURSE_OVERVIEW_TABS.TOC && <ChapterListOverview />}

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
