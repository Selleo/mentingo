import { useTranslation } from "react-i18next";

import { useExportLearningPath } from "~/api/mutations/admin/useExportLearningPath";
import { useLearningPathExportCandidates } from "~/api/queries/admin/useLearningPathExportCandidates";
import { TenantSharingPicker } from "~/modules/common/TenantSharing/TenantSharingPicker";
import { useTenantSharingPicker } from "~/modules/common/TenantSharing/useTenantSharingPicker";

type LearningPathExportsSectionProps = {
  learningPathId: string;
};

export function LearningPathExportsSection({ learningPathId }: LearningPathExportsSectionProps) {
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
  } = useTenantSharingPicker(learningPathId);
  const { data: exportCandidates, isFetching } = useLearningPathExportCandidates(
    learningPathId,
    searchParams,
  );
  const { mutateAsync: exportLearningPath, isPending: isExportPending } = useExportLearningPath();

  const shareWithSelectedTenants = async () => {
    if (!selectedTenantIds.length) return;

    await exportLearningPath({ learningPathId, targetTenantIds: selectedTenantIds });
    clearSelection();
  };

  return (
    <TenantSharingPicker
      title={t("adminLearningPathsView.sharedLearningPath.exportsTitle")}
      description={t("adminLearningPathsView.sharedLearningPath.exportsDescription")}
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
  );
}
