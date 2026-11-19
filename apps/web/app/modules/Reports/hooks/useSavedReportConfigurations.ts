import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCreateReportConfiguration } from "~/api/mutations/useCreateReportConfiguration";
import { useDeleteReportConfiguration } from "~/api/mutations/useDeleteReportConfiguration";
import { useUpdateReportConfiguration } from "~/api/mutations/useUpdateReportConfiguration";
import { useReportConfigurations } from "~/api/queries/useReportConfigurations";

import { restoreSavedConfiguration } from "../utils/reportConfiguration.utils";
import { toReportDefinition } from "../utils/reportQuery.utils";

import type {
  ReportConfigurationVisibility,
  ReportOptions,
  ReportSavedConfiguration,
} from "../types/reports-api.types";
import type { ReportConfiguration, ReportInaccessibleReference } from "../types/reports.types";

type UseSavedReportConfigurationsParams = {
  options: ReportOptions | undefined;
  onRestore: (
    configuration: ReportConfiguration,
    inaccessibleReference: ReportInaccessibleReference | null,
  ) => void;
};

/** Lists, opens, saves and deletes saved report configurations for the reports page. */
export function useSavedReportConfigurations({
  options,
  onRestore,
}: UseSavedReportConfigurationsParams) {
  const { t } = useTranslation();
  const [saveName, setSaveName] = useState("");
  const [saveVisibility, setSaveVisibility] = useState<ReportConfigurationVisibility>("personal");
  const [isSaveFormOpen, setIsSaveFormOpen] = useState(false);
  const [activeConfigurationId, setActiveConfigurationId] = useState<string>();
  const configurationsQuery = useReportConfigurations();
  const { mutateAsync: createConfiguration, isPending: isCreating } =
    useCreateReportConfiguration();
  const { mutateAsync: updateConfiguration, isPending: isUpdating } =
    useUpdateReportConfiguration();
  const { mutateAsync: deleteConfiguration } = useDeleteReportConfiguration();
  const canManageShared = Boolean(options?.canManageShared);

  const openSavedConfiguration = (saved: ReportSavedConfiguration) => {
    const restored = restoreSavedConfiguration(
      saved,
      options,
      t("reports.saved.inaccessibleSubject"),
    );
    const isAvailable = "isAvailable" in saved ? saved.isAvailable : true;
    setActiveConfigurationId(
      saved.visibility === "personal" || canManageShared ? saved.id : undefined,
    );
    setSaveName(saved.name);
    setSaveVisibility(
      saved.visibility === "shared" && !canManageShared ? "personal" : saved.visibility,
    );
    onRestore(
      restored,
      isAvailable
        ? null
        : {
            subjectId: saved.query.subjectId,
            groupIds: saved.query.groupIds,
            filters: JSON.stringify(restored.filters),
          },
    );
  };

  const saveConfiguration = async (draft: ReportConfiguration) => {
    const query = toReportDefinition(draft, draft.timezone);
    if (activeConfigurationId) {
      await updateConfiguration({
        id: activeConfigurationId,
        name: saveName,
        visibility: saveVisibility,
        query,
      });
    } else {
      const saved = await createConfiguration({
        name: saveName,
        visibility: saveVisibility,
        query,
      });
      setActiveConfigurationId(saved.id);
    }
    setSaveName("");
    setIsSaveFormOpen(false);
  };

  const deleteSavedConfiguration = (saved: ReportSavedConfiguration) => {
    deleteConfiguration(saved.id);
    if (activeConfigurationId === saved.id) setActiveConfigurationId(undefined);
  };

  return {
    configurations: configurationsQuery.data ?? [],
    isLoadingConfigurations: configurationsQuery.isLoading,
    activeConfigurationId,
    canManageShared,
    saveName,
    saveVisibility,
    isSaveFormOpen,
    isSaving: isCreating || isUpdating,
    setSaveName,
    setSaveVisibility,
    setIsSaveFormOpen,
    openSavedConfiguration,
    saveConfiguration,
    deleteSavedConfiguration,
  };
}
