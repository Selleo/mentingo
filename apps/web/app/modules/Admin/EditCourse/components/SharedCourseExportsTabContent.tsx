import { useTranslation } from "react-i18next";

import { useExportMasterCourse } from "~/api/mutations/admin/useExportMasterCourse";
import { useMasterCourseExportCandidates } from "~/api/queries/admin/useMasterCourseExportCandidates";
import { Card, CardContent } from "~/components/ui/card";
import { TenantSharingPicker } from "~/modules/common/TenantSharing/TenantSharingPicker";
import { useTenantSharingPicker } from "~/modules/common/TenantSharing/useTenantSharingPicker";

type SharedCourseExportsTabContentProps = {
  courseId: string;
};

export const SharedCourseExportsTabContent = ({ courseId }: SharedCourseExportsTabContentProps) => {
  const { t } = useTranslation();
  const {
    searchInput,
    setSearchInput,
    search,
    searchParams,
    setPage,
    rowSelection,
    setRowSelection,
    selectedTenantIds,
    clearSelection,
  } = useTenantSharingPicker(courseId);
  const { data: exportCandidates, isFetching } = useMasterCourseExportCandidates(
    courseId,
    searchParams,
  );
  const { mutateAsync: exportMasterCourse, isPending: isExportPending } = useExportMasterCourse();

  const shareWithSelectedTenants = async () => {
    if (!selectedTenantIds.length) return;

    await exportMasterCourse({ courseId, targetTenantIds: selectedTenantIds });
    clearSelection();
  };

  return (
    <Card className="border-neutral-200 shadow-sm">
      <CardContent className="p-6">
        <TenantSharingPicker
          title={t("adminCourseView.sharedCourse.exportsTitle")}
          description={t("adminCourseView.sharedCourse.exportsDescription")}
          tenants={exportCandidates?.data.tenants}
          pagination={exportCandidates?.pagination}
          search={search}
          searchInput={searchInput}
          onSearchInputChange={setSearchInput}
          onPageChange={setPage}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          selectedCount={selectedTenantIds.length}
          onClearSelection={clearSelection}
          isFetching={isFetching}
          isSharePending={isExportPending}
          onShare={() => void shareWithSelectedTenants()}
        />
      </CardContent>
    </Card>
  );
};
