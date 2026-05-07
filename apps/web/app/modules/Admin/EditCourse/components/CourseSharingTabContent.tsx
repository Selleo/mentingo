import { ScormExportCard } from "./ScormExportCard";
import { SharedCourseExportsTabContent } from "./SharedCourseExportsTabContent";

import type { SupportedLanguages } from "@repo/shared";
import type { GetMasterCourseExportCandidatesResponse } from "~/api/generated-api";

type CourseSharingTabContentProps = {
  courseId: string;
  language: SupportedLanguages;
  unsupportedLessonCount: number;
  showTenantSharing: boolean;
  tenants: GetMasterCourseExportCandidatesResponse["data"]["tenants"];
  selectedTenantIds: string[];
  canExportMore: boolean;
  isExportPending: boolean;
  onToggleTenantSelection: (tenantId: string, checked: boolean) => void;
  onExport: () => void | Promise<void>;
};

export const CourseSharingTabContent = ({
  courseId,
  language,
  unsupportedLessonCount,
  showTenantSharing,
  tenants,
  selectedTenantIds,
  canExportMore,
  isExportPending,
  onToggleTenantSelection,
  onExport,
}: CourseSharingTabContentProps) => {
  return (
    <div className="flex w-full max-w-[1040px] flex-col gap-5">
      <ScormExportCard
        courseId={courseId}
        language={language}
        unsupportedLessonCount={unsupportedLessonCount}
      />
      {showTenantSharing && (
        <SharedCourseExportsTabContent
          tenants={tenants}
          selectedTenantIds={selectedTenantIds}
          canExportMore={canExportMore}
          isExportPending={isExportPending}
          onToggleTenantSelection={onToggleTenantSelection}
          onExport={onExport}
        />
      )}
    </div>
  );
};
