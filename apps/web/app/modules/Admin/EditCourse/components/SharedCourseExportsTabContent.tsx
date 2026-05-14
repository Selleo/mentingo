import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";

import type { GetMasterCourseExportCandidatesResponse } from "~/api/generated-api";

type SharedCourseExportsTabContentProps = {
  tenants: GetMasterCourseExportCandidatesResponse["data"]["tenants"];
  selectedTenantIds: string[];
  canExportMore: boolean;
  isExportPending: boolean;
  onToggleTenantSelection: (tenantId: string, checked: boolean) => void;
  onExport: () => void | Promise<void>;
};

export const SharedCourseExportsTabContent = ({
  tenants,
  selectedTenantIds,
  canExportMore,
  isExportPending,
  onToggleTenantSelection,
  onExport,
}: SharedCourseExportsTabContentProps) => {
  const { t } = useTranslation();

  return (
    <Card className="border-neutral-200 shadow-sm">
      <CardHeader className="px-6 pb-4 pt-6">
        <CardTitle className="text-base font-semibold text-neutral-950">
          {t("adminCourseView.sharedCourse.exportsTitle")}
        </CardTitle>
        <p className="body-base text-neutral-900">
          {t("adminCourseView.sharedCourse.exportsDescription")}
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-y-3 px-6 pb-6">
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
                  <Badge variant="secondaryWithOutline">
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
      </CardContent>
    </Card>
  );
};
