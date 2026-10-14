import { useCurrentUser } from "~/api/queries";
import { CourseSharingTabContent } from "~/modules/Admin/EditCourse/components/CourseSharingTabContent";

import type { SupportedLanguages } from "@repo/shared";

type CourseSettingsSharingTabProps = {
  courseId: string;
  language: SupportedLanguages;
  unsupportedLessonCount: number;
};

export default function CourseSettingsSharingTab({
  courseId,
  language,
  unsupportedLessonCount,
}: CourseSettingsSharingTabProps) {
  const { data: currentUser } = useCurrentUser();
  const showTenantSharing = Boolean(
    currentUser?.isManagingTenantAdmin && !currentUser.isSupportMode,
  );

  return (
    <CourseSharingTabContent
      courseId={courseId}
      language={language}
      unsupportedLessonCount={unsupportedLessonCount}
      showTenantSharing={showTenantSharing}
    />
  );
}
