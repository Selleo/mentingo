import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useExportLearningPath } from "~/api/mutations/admin/useExportLearningPath";
import { useLearningPathExportCandidates } from "~/api/queries/admin/useLearningPathExportCandidates";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";

type LearningPathExportsSectionProps = {
  learningPathId: string;
};

export function LearningPathExportsSection({ learningPathId }: LearningPathExportsSectionProps) {
  const { t } = useTranslation();
  const { data: exportCandidates } = useLearningPathExportCandidates(learningPathId);
  const { mutateAsync: exportLearningPath, isPending: isExportPending } = useExportLearningPath();
  const { tenants: shareableTenants = [], summary } = exportCandidates ?? {};

  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedTenantIds([]);
  }, [learningPathId]);

  const canExportMore = (summary?.remainingCount ?? 0) > 0;

  const validSelectedTenantIds = useMemo(
    () =>
      selectedTenantIds
        .map((tenantId) => tenantId.trim())
        .filter(Boolean)
        .filter((tenantId) => {
          const tenant = shareableTenants.find(
            (candidateTenant) => candidateTenant.id === tenantId,
          );
          return Boolean(tenant) && !tenant?.isExported;
        }),
    [selectedTenantIds, shareableTenants],
  );

  const handleExport = async () => {
    if (!validSelectedTenantIds.length) return;
    await exportLearningPath({
      learningPathId,
      targetTenantIds: validSelectedTenantIds,
    });
    setSelectedTenantIds([]);
  };

  const toggleTenantSelection = (tenantId: string, checked: boolean) => {
    setSelectedTenantIds((prev) => {
      if (!checked) return prev.filter((id) => id !== tenantId);
      if (prev.includes(tenantId)) return prev;
      return [...prev, tenantId];
    });
  };

  return (
    <div className="grid gap-4">
      <h2 className="body-sm-md text-neutral-950">
        {t("adminLearningPathsView.sharedLearningPath.exportsTitle")}
      </h2>
      <div className="grid gap-4">
        <p className="details-md text-neutral-600">
          {t("adminLearningPathsView.sharedLearningPath.exportsDescription")}
        </p>
        <h3 className="body-sm-md text-neutral-950">
          {t("adminLearningPathsView.sharedLearningPath.selectTenants")}
        </h3>
        <div className="max-h-[260px] overflow-y-auto rounded-lg border border-primary-100">
          {shareableTenants.map((tenant) => {
            const checked = selectedTenantIds.includes(tenant.id);

            return (
              <label
                key={tenant.id}
                className="flex items-center justify-between gap-3 border-b border-primary-50 px-4 py-3 last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={checked}
                    disabled={tenant.isExported}
                    onCheckedChange={(value) => {
                      toggleTenantSelection(tenant.id, value === true);
                    }}
                  />
                  <span className="text-sm text-neutral-900">{tenant.name}</span>
                </div>
                {tenant.isExported && (
                  <Badge variant="secondaryWithOutline">
                    {t("adminLearningPathsView.sharedLearningPath.badgeExported")}
                  </Badge>
                )}
              </label>
            );
          })}
        </div>
        <div className="flex items-center justify-between">
          <p className="details-md text-neutral-600">
            {t("adminLearningPathsView.sharedLearningPath.selectedCount")}{" "}
            <span className="font-semibold text-neutral-900">{validSelectedTenantIds.length}</span>
          </p>
          <Button
            type="button"
            onClick={() => {
              void handleExport();
            }}
            disabled={!validSelectedTenantIds.length || isExportPending || !canExportMore}
          >
            {isExportPending
              ? t("adminLearningPathsView.sharedLearningPath.exportingButton")
              : t("adminLearningPathsView.sharedLearningPath.exportButton")}
          </Button>
        </div>
      </div>
    </div>
  );
}
