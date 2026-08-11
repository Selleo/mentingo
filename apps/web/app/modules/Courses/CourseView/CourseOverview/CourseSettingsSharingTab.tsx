import { useCallback, useMemo, useState } from "react";

import { useExportMasterCourse } from "~/api/mutations/admin/useExportMasterCourse";
import { useCurrentUser } from "~/api/queries";
import { useMasterCourseExportCandidates } from "~/api/queries/admin/useMasterCourseExportCandidates";
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
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const { data: exportCandidates } = useMasterCourseExportCandidates(courseId, showTenantSharing);
  const { mutateAsync: exportMasterCourse, isPending: isExportPending } = useExportMasterCourse();
  const { tenants = [], summary } = exportCandidates ?? {};
  const canExportMore = (summary?.remainingCount ?? 0) > 0;
  const validSelectedTenantIds = useMemo(
    () =>
      selectedTenantIds.filter((tenantId) => {
        const tenant = tenants.find((candidate) => candidate.id === tenantId);
        return Boolean(tenant && !tenant.isExported);
      }),
    [selectedTenantIds, tenants],
  );

  const toggleTenantSelection = useCallback((tenantId: string, checked: boolean) => {
    setSelectedTenantIds((current) => {
      if (!checked) return current.filter((selectedId) => selectedId !== tenantId);
      if (current.includes(tenantId)) return current;
      return [...current, tenantId];
    });
  }, []);

  const handleExport = useCallback(async () => {
    if (!validSelectedTenantIds.length) return;
    await exportMasterCourse({ courseId, targetTenantIds: validSelectedTenantIds });
    setSelectedTenantIds([]);
  }, [courseId, exportMasterCourse, validSelectedTenantIds]);

  return (
    <CourseSharingTabContent
      courseId={courseId}
      language={language}
      unsupportedLessonCount={unsupportedLessonCount}
      showTenantSharing={showTenantSharing}
      tenants={tenants}
      selectedTenantIds={validSelectedTenantIds}
      canExportMore={canExportMore}
      isExportPending={isExportPending}
      onToggleTenantSelection={toggleTenantSelection}
      onExport={handleExport}
    />
  );
}
