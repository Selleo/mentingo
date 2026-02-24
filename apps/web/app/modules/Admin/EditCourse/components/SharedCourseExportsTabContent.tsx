import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Separator } from "~/components/ui/separator";

import type { GetMasterCourseExportCandidatesResponse } from "~/api/generated-api";

type SharedCourseExportsTabContentProps = {
  tenants: GetMasterCourseExportCandidatesResponse["data"]["tenants"];
  selectedTenantIds: string[];
  exportedCount: number;
  remainingCount: number;
  canExportMore: boolean;
  isExportPending: boolean;
  onToggleTenantSelection: (tenantId: string, checked: boolean) => void;
  onExport: () => void | Promise<void>;
};

export const SharedCourseExportsTabContent = ({
  tenants,
  selectedTenantIds,
  exportedCount,
  remainingCount,
  canExportMore,
  isExportPending,
  onToggleTenantSelection,
  onExport,
}: SharedCourseExportsTabContentProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex w-full max-w-[1000px] flex-col gap-y-6 bg-white p-8">
      <div className="flex flex-col gap-y-1.5">
        <h5 className="h5 text-neutral-950">{t("adminCourseView.sharedCourse.exportsTitle")}</h5>
        <p className="body-base text-neutral-900">
          {t("adminCourseView.sharedCourse.exportsDescription")}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="successFilled" fontWeight="bold">
          {t("adminCourseView.sharedCourse.exportedCount", { count: exportedCount })}
        </Badge>
        <Badge variant="default" fontWeight="bold">
          {t("adminCourseView.sharedCourse.remainingCount", { count: remainingCount })}
        </Badge>
      </div>

      <Separator />

      <div className="flex flex-col gap-y-3">
        <h6 className="font-semibold text-neutral-950">
          {t("adminCourseView.sharedCourse.selectTenants")}
        </h6>
        <div className="max-h-[320px] overflow-y-auto rounded-lg border border-neutral-200">
          {tenants.map((tenant) => {
            const { isExported: isAlreadyExported } = tenant;
            const checked = selectedTenantIds.includes(tenant.id);

            return (
              <label
                key={tenant.id}
                className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3 last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={checked}
                    disabled={isAlreadyExported}
                    onCheckedChange={(value) => {
                      onToggleTenantSelection(tenant.id, value === true);
                    }}
                  />
                  <span className="text-sm text-neutral-900">{tenant.name}</span>
                </div>
                {isAlreadyExported && (
                  <Badge variant="secondary" fontWeight="bold">
                    {t("adminCourseView.sharedCourse.badgeExported")}
                  </Badge>
                )}
              </label>
            );
          })}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-600">
            {t("adminCourseView.sharedCourse.selectedCount")}{" "}
            <span className="font-semibold text-neutral-900">{selectedTenantIds.length}</span>
          </p>
          <Button
            onClick={onExport}
            disabled={!selectedTenantIds.length || isExportPending || !canExportMore}
          >
            {isExportPending
              ? t("adminCourseView.sharedCourse.exportingButton")
              : t("adminCourseView.sharedCourse.exportButton")}
          </Button>
        </div>
      </div>
    </div>
  );
};
