import {
  DIRECTORY_SYNC_ARCHIVE_LIMIT_PERCENTAGE,
  DIRECTORY_SYNC_SCOPE_TYPES,
  type DirectorySyncProvider,
  type DirectorySyncScopeType,
} from "@repo/shared";
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useUpsertDirectorySyncConnection } from "~/api/mutations/admin/useUpsertDirectorySyncConnection";
import { directorySyncGroupsQueryOptions } from "~/api/queries/admin/useDirectorySyncGroups";
import { useDirectorySyncOrganizationalUnits } from "~/api/queries/admin/useDirectorySyncOrganizationalUnits";
import { useRoles } from "~/api/queries/admin/useRoles";
import { queryClient } from "~/api/queryClient";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import MultipleSelector, { type Option } from "~/components/ui/multiselect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { getRoleLabel } from "~/modules/Admin/Users/utils/getRoleLabel";

import { SETTINGS_PAGE_HANDLES } from "../../../../../../e2e/data/settings/handles";

import { SUGGESTED_ARCHIVE_LIMIT_PERCENTAGE } from "./directorySync.constants";
import { DirectorySyncSearchLoading } from "./DirectorySyncSearchLoading";

import type { DirectorySyncConnection } from "./directorySync.types";

type DirectorySyncConnectionFormProps = {
  provider: DirectorySyncProvider;
  connection: DirectorySyncConnection;
};

/** Settings tab: who is synced, defaults and sync behaviour, saved with one button. */
export function DirectorySyncConnectionForm({
  provider,
  connection,
}: DirectorySyncConnectionFormProps) {
  const { t } = useTranslation();
  const { data: roles = [] } = useRoles();
  const { mutateAsync: upsertConnection, isPending } = useUpsertDirectorySyncConnection();

  const [scopeType, setScopeType] = useState<DirectorySyncScopeType>(connection.scopeType);
  const [selectedScopeIds, setSelectedScopeIds] = useState<string[]>(connection.scopeExternalIds);
  const [scopeLabelsById, setScopeLabelsById] = useState<Record<string, string>>({});
  const [defaultRoleId, setDefaultRoleId] = useState(connection.defaultRoleId);
  const [archiveUsersOutsideScope, setArchiveUsersOutsideScope] = useState(
    connection.archiveUsersOutsideScope,
  );
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(connection.sendWelcomeEmail);
  const [archiveLimitPercentage, setArchiveLimitPercentage] = useState<number | null>(
    connection.archiveLimitPercentage,
  );

  const isOrganizationalUnitScope = scopeType === DIRECTORY_SYNC_SCOPE_TYPES.ORGANIZATIONAL_UNITS;
  const { data: organizationalUnits = [], isLoading: isLoadingOrganizationalUnits } =
    useDirectorySyncOrganizationalUnits(provider, isOrganizationalUnitScope);

  const organizationalUnitOptions = useMemo(
    () =>
      organizationalUnits.map((organizationalUnit) => ({
        value: organizationalUnit.externalId,
        label: organizationalUnit.path,
      })),
    [organizationalUnits],
  );

  const selectedScopeOptions: Option[] = selectedScopeIds.map((scopeId) => ({
    value: scopeId,
    label:
      organizationalUnitOptions.find((option) => option.value === scopeId)?.label ??
      scopeLabelsById[scopeId] ??
      scopeId,
  }));

  const searchGroupOptions = async (searchPhrase: string): Promise<Option[]> => {
    const groups = await queryClient.fetchQuery(
      directorySyncGroupsQueryOptions(provider, searchPhrase, true),
    );

    return groups.map((group) => ({ value: group.externalId, label: group.email }));
  };

  const selectScopeOptions = (options: Option[]) => {
    setSelectedScopeIds(options.map((option) => option.value));
    setScopeLabelsById((currentLabels) => ({
      ...currentLabels,
      ...Object.fromEntries(options.map((option) => [option.value, option.label])),
    }));
  };

  const changeScopeType = (nextScopeType: DirectorySyncScopeType) => {
    setScopeType(nextScopeType);
    setSelectedScopeIds([]);
  };

  const isScopeComplete =
    scopeType === DIRECTORY_SYNC_SCOPE_TYPES.ALL_USERS || selectedScopeIds.length > 0;
  const canSave = Boolean(defaultRoleId && isScopeComplete);

  const saveConnection = () =>
    upsertConnection({
      provider,
      connectionSettings: {
        administratorEmail: connection.administratorEmail,
        scopeType,
        scopeExternalIds: selectedScopeIds,
        defaultRoleId,
        archiveUsersOutsideScope,
        sendWelcomeEmail,
        archiveLimitPercentage,
      },
    });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("directorySync.form.scope")}</Label>
          <Select
            value={scopeType}
            onValueChange={(value) => changeScopeType(value as DirectorySyncScopeType)}
          >
            <SelectTrigger data-testid={SETTINGS_PAGE_HANDLES.DIRECTORY_SYNC_SCOPE_TYPE_SELECT}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(DIRECTORY_SYNC_SCOPE_TYPES).map((scopeTypeOption) => (
                <SelectItem key={scopeTypeOption} value={scopeTypeOption}>
                  {t(`directorySync.form.scopeTypes.${scopeTypeOption}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t("directorySync.form.defaultRole")}</Label>
          <Select value={defaultRoleId} onValueChange={setDefaultRoleId}>
            <SelectTrigger data-testid={SETTINGS_PAGE_HANDLES.DIRECTORY_SYNC_DEFAULT_ROLE_SELECT}>
              <SelectValue placeholder={t("directorySync.form.defaultRolePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {getRoleLabel(role.slug, t, roles)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="body-sm text-neutral-600">
            {t("directorySync.form.defaultRoleDescription")}
          </p>
        </div>

        {match(scopeType)
          .with(DIRECTORY_SYNC_SCOPE_TYPES.ALL_USERS, () => null)
          .with(DIRECTORY_SYNC_SCOPE_TYPES.ORGANIZATIONAL_UNITS, () => (
            <div className="md:col-span-2">
              <MultipleSelector
                value={selectedScopeOptions}
                options={organizationalUnitOptions}
                onChange={selectScopeOptions}
                disabled={isLoadingOrganizationalUnits}
                placeholder={
                  isLoadingOrganizationalUnits
                    ? t("common.button.loading")
                    : t("directorySync.form.organizationalUnitsPlaceholder")
                }
                emptyIndicator={<p>{t("directorySync.form.noResults")}</p>}
                hidePlaceholderWhenSelected
              />
            </div>
          ))
          .with(DIRECTORY_SYNC_SCOPE_TYPES.GROUPS, () => (
            <div className="md:col-span-2">
              <MultipleSelector
                value={selectedScopeOptions}
                onSearch={searchGroupOptions}
                loadingIndicator={<DirectorySyncSearchLoading />}
                triggerSearchOnFocus
                delay={300}
                onChange={selectScopeOptions}
                placeholder={t("directorySync.form.groupsPlaceholder")}
                emptyIndicator={<p>{t("directorySync.form.noResults")}</p>}
                hidePlaceholderWhenSelected
              />
            </div>
          ))
          .exhaustive()}
      </div>

      <div className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
        <SettingSwitch
          id="directory-sync-archive-outside-scope"
          label={t("directorySync.form.archiveUsersOutsideScope")}
          description={t("directorySync.form.archiveUsersOutsideScopeDescription")}
          checked={archiveUsersOutsideScope}
          onCheckedChange={setArchiveUsersOutsideScope}
        />
        <SettingSwitch
          id="directory-sync-send-welcome-email"
          label={t("directorySync.form.sendWelcomeEmail")}
          description={t("directorySync.form.sendWelcomeEmailDescription")}
          checked={sendWelcomeEmail}
          onCheckedChange={setSendWelcomeEmail}
        />
        <SettingSwitch
          id="directory-sync-archive-limit"
          label={t("directorySync.form.archiveLimit")}
          description={t("directorySync.form.archiveLimitDescription")}
          checked={archiveLimitPercentage !== null}
          onCheckedChange={(checked) =>
            setArchiveLimitPercentage(checked ? SUGGESTED_ARCHIVE_LIMIT_PERCENTAGE : null)
          }
          control={
            archiveLimitPercentage !== null && (
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  className="h-9 w-20"
                  min={DIRECTORY_SYNC_ARCHIVE_LIMIT_PERCENTAGE.MIN}
                  max={DIRECTORY_SYNC_ARCHIVE_LIMIT_PERCENTAGE.MAX}
                  value={archiveLimitPercentage}
                  aria-label={t("directorySync.form.archiveLimit")}
                  onChange={(event) =>
                    setArchiveLimitPercentage(
                      clampArchiveLimitPercentage(event.target.valueAsNumber),
                    )
                  }
                />
                <span className="body-sm text-neutral-700">%</span>
              </div>
            )
          }
        />
      </div>

      <div className="flex justify-end">
        <Button
          onClick={saveConnection}
          disabled={!canSave || isPending}
          className="min-w-28"
          data-testid={SETTINGS_PAGE_HANDLES.DIRECTORY_SYNC_SAVE_BUTTON}
        >
          {t("common.button.save")}
        </Button>
      </div>
    </div>
  );
}

type SettingSwitchProps = {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  control?: ReactNode;
};

function SettingSwitch({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  control,
}: SettingSwitchProps) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id} className="body-base-md">
          {label}
        </Label>
        <p className="body-sm-md text-muted-foreground">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        {control}
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  );
}

function clampArchiveLimitPercentage(percentage: number) {
  if (Number.isNaN(percentage)) return DIRECTORY_SYNC_ARCHIVE_LIMIT_PERCENTAGE.MIN;

  return Math.min(
    DIRECTORY_SYNC_ARCHIVE_LIMIT_PERCENTAGE.MAX,
    Math.max(DIRECTORY_SYNC_ARCHIVE_LIMIT_PERCENTAGE.MIN, Math.round(percentage)),
  );
}
