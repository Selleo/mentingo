import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useSaveDirectorySyncGroups } from "~/api/mutations/admin/useSaveDirectorySyncGroups";
import { directorySyncGroupsQueryOptions } from "~/api/queries/admin/useDirectorySyncGroups";
import { groupsQueryOptions } from "~/api/queries/admin/useGroups";
import { useRoles } from "~/api/queries/admin/useRoles";
import { queryClient } from "~/api/queryClient";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import MultipleSelector, { type Option } from "~/components/ui/multiselect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { getRoleLabel } from "~/modules/Admin/Users/utils/getRoleLabel";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { SETTINGS_PAGE_HANDLES } from "../../../../../../e2e/data/settings/handles";

import { DirectoryGroupLabel } from "./DirectoryGroupLabel";
import { DirectorySyncSearchLoading } from "./DirectorySyncSearchLoading";

import type { DirectorySyncConnection } from "./directorySync.types";
import type { DirectorySyncProvider } from "@repo/shared";
import type { RoleOption } from "~/api/queries/admin/useRoles";

const NO_ROLE_VALUE = "no-role";
const CREATE_GROUP_VALUE = "create-group";

type GoogleGroupRow = {
  externalGroupId: string;
  externalGroupEmail: string;
  externalGroupName: string;
  roleId: string | null;
  syncsMembers: boolean;
  groupId: string | null;
  groupName: string | null;
};

type DirectorySyncGroupsEditorProps = {
  provider: DirectorySyncProvider;
  connection: DirectorySyncConnection;
};

/**
 * One list of Google groups. Each group can give its members a role and/or keep a Mentingo
 * group's membership in sync. Row order decides the role when a user is in several groups.
 */
export function DirectorySyncGroupsEditor({
  provider,
  connection,
}: DirectorySyncGroupsEditorProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const { data: roles = [] } = useRoles();
  const { mutateAsync: saveGroups, isPending } = useSaveDirectorySyncGroups();

  const [rows, setRows] = useState<GoogleGroupRow[]>(() => toGoogleGroupRows(connection));
  const directoryGroupNamesById = useRef(new Map<string, string>());

  const savedGroupSyncIds = new Set(
    connection.groupMappings.map((groupMapping) => groupMapping.externalGroupId),
  );
  const listedExternalGroupIds = new Set(rows.map((row) => row.externalGroupId));

  const searchUnlistedGoogleGroups = async (searchPhrase: string): Promise<Option[]> => {
    const directoryGroups = await queryClient.fetchQuery(
      directorySyncGroupsQueryOptions(provider, searchPhrase, true),
    );

    directoryGroups.forEach((directoryGroup) =>
      directoryGroupNamesById.current.set(directoryGroup.externalId, directoryGroup.name),
    );

    return directoryGroups
      .filter((directoryGroup) => !listedExternalGroupIds.has(directoryGroup.externalId))
      .map((directoryGroup) => ({ value: directoryGroup.externalId, label: directoryGroup.email }));
  };

  const addGoogleGroup = ([googleGroupOption]: Option[]) => {
    if (!googleGroupOption) return;

    setRows((currentRows) => [
      ...currentRows,
      {
        externalGroupId: googleGroupOption.value,
        externalGroupEmail: googleGroupOption.label,
        externalGroupName:
          directoryGroupNamesById.current.get(googleGroupOption.value) ?? googleGroupOption.label,
        roleId: null,
        syncsMembers: false,
        groupId: null,
        groupName: null,
      },
    ]);
  };

  const updateRow = (externalGroupId: string, changes: Partial<GoogleGroupRow>) =>
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.externalGroupId === externalGroupId ? { ...row, ...changes } : row,
      ),
    );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reorderRowsAfterDrag = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;

    setRows((currentRows) => {
      const fromIndex = currentRows.findIndex((row) => row.externalGroupId === active.id);
      const toIndex = currentRows.findIndex((row) => row.externalGroupId === over.id);

      return arrayMove(currentRows, fromIndex, toIndex);
    });
  };

  const removeRow = (externalGroupId: string) =>
    setRows((currentRows) => currentRows.filter((row) => row.externalGroupId !== externalGroupId));

  const saveGoogleGroups = async () => {
    const rowsWithRole = rows.filter((row) => row.roleId);
    const updatedConnection = await saveGroups({
      provider,
      roleMappings: rowsWithRole.map((row, index) => ({
        externalGroupId: row.externalGroupId,
        externalGroupEmail: row.externalGroupEmail,
        roleId: row.roleId ?? "",
        priority: index,
      })),
      groupMappings: {
        language,
        groupMappings: rows
          .filter((row) => row.syncsMembers)
          .map((row) => ({
            externalGroupId: row.externalGroupId,
            externalGroupEmail: row.externalGroupEmail,
            externalGroupName: row.externalGroupName,
            groupId: row.groupId,
          })),
      },
    }).catch(() => null);

    if (updatedConnection) setRows(toGoogleGroupRows(updatedConnection));
  };

  return (
    <div className="space-y-4">
      <p className="body-sm text-neutral-600">{t("directorySync.groups.description")}</p>

      <MultipleSelector
        key={rows.length}
        onSearch={searchUnlistedGoogleGroups}
        loadingIndicator={<DirectorySyncSearchLoading />}
        triggerSearchOnFocus
        delay={300}
        maxSelected={1}
        onChange={addGoogleGroup}
        placeholder={t("directorySync.groups.addPlaceholder")}
        emptyIndicator={<p>{t("directorySync.form.noResults")}</p>}
      />

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-600">
          {t("directorySync.groups.empty")}
        </p>
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-white">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={reorderRowsAfterDrag}
          >
            <table className="w-full caption-bottom text-sm">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 px-2">
                    <span className="sr-only">{t("directorySync.groups.dragToReorder")}</span>
                  </TableHead>
                  <TableHead>{t("directorySync.groups.columns.googleGroup")}</TableHead>
                  <TableHead className="w-48">{t("directorySync.groups.columns.role")}</TableHead>
                  <TableHead className="w-96">
                    {t("directorySync.groups.columns.mentingoGroup")}
                  </TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">{t("directorySync.groups.columns.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <SortableContext
                items={rows.map((row) => row.externalGroupId)}
                strategy={verticalListSortingStrategy}
              >
                <TableBody>
                  {rows.map((row) => (
                    <GoogleGroupRowItem
                      key={row.externalGroupId}
                      row={row}
                      roles={roles}
                      isMissingInDirectory={connection.missingExternalIds.includes(
                        row.externalGroupId,
                      )}
                      requiresRemovalConfirmation={savedGroupSyncIds.has(row.externalGroupId)}
                      onChange={(changes) => updateRow(row.externalGroupId, changes)}
                      onRemove={() => removeRow(row.externalGroupId)}
                    />
                  ))}
                </TableBody>
              </SortableContext>
            </table>
          </DndContext>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={saveGoogleGroups}
          disabled={isPending}
          className="min-w-28"
          data-testid={SETTINGS_PAGE_HANDLES.DIRECTORY_SYNC_GROUP_MAPPINGS_SAVE_BUTTON}
        >
          {t("common.button.save")}
        </Button>
      </div>
    </div>
  );
}

type GoogleGroupRowItemProps = {
  row: GoogleGroupRow;
  roles: RoleOption[];
  isMissingInDirectory: boolean;
  requiresRemovalConfirmation: boolean;
  onChange: (changes: Partial<GoogleGroupRow>) => void;
  onRemove: () => void;
};

function GoogleGroupRowItem({
  row,
  roles,
  isMissingInDirectory,
  requiresRemovalConfirmation,
  onChange,
  onRemove,
}: GoogleGroupRowItemProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.externalGroupId });

  const createGroupOption: Option = {
    value: CREATE_GROUP_VALUE,
    label: t("directorySync.groups.createGroupOption", { name: row.externalGroupName }),
  };

  const selectedGroupOptions = toSelectedGroupOptions(row, createGroupOption);

  const searchMentingoGroups = async (searchPhrase: string): Promise<Option[]> => {
    const groupsResponse = await queryClient.fetchQuery(
      groupsQueryOptions({ name: searchPhrase, language }),
    );

    return [
      createGroupOption,
      ...groupsResponse.data.map((group) => ({ value: group.id, label: group.name })),
    ];
  };

  const selectMentingoGroup = ([groupOption]: Option[]) => {
    if (!groupOption) {
      onChange({ syncsMembers: false, groupId: null, groupName: null });
      return;
    }

    if (groupOption.value === CREATE_GROUP_VALUE) {
      onChange({ syncsMembers: true, groupId: null, groupName: null });
      return;
    }

    onChange({ syncsMembers: true, groupId: groupOption.value, groupName: groupOption.label });
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("bg-white hover:bg-neutral-50", isDragging && "relative z-10 shadow-md")}
    >
      <TableCell className="w-10 px-2 py-2">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="flex size-7 cursor-grab items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 active:cursor-grabbing"
          aria-label={t("directorySync.groups.dragToReorder")}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      </TableCell>
      <TableCell className="py-2">
        <DirectoryGroupLabel
          email={row.externalGroupEmail}
          isMissingInDirectory={isMissingInDirectory}
        />
      </TableCell>
      <TableCell className="py-2">
        <Select
          value={row.roleId ?? NO_ROLE_VALUE}
          onValueChange={(value) => onChange({ roleId: value === NO_ROLE_VALUE ? null : value })}
        >
          <SelectTrigger aria-label={t("directorySync.groups.columns.role")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_ROLE_VALUE}>{t("directorySync.groups.noRole")}</SelectItem>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {getRoleLabel(role.slug, t, roles)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="py-2">
        <MultipleSelector
          value={selectedGroupOptions}
          onSearch={searchMentingoGroups}
          loadingIndicator={<DirectorySyncSearchLoading />}
          triggerSearchOnFocus
          delay={300}
          maxSelected={1}
          onChange={selectMentingoGroup}
          placeholder={t("directorySync.groups.notSynced")}
          inputProps={{ className: cn(selectedGroupOptions.length > 0 && "w-px min-w-0") }}
          emptyIndicator={<p>{t("directorySync.form.noResults")}</p>}
          hidePlaceholderWhenSelected
        />
      </TableCell>
      <TableCell className="py-2 text-right">
        {requiresRemovalConfirmation ? (
          <RemoveSyncedGroupDialog
            groupName={row.groupName ?? row.externalGroupName}
            onConfirm={onRemove}
          />
        ) : (
          <RemoveRowButton onClick={onRemove} />
        )}
      </TableCell>
    </TableRow>
  );
}

/** Empty means not synced; the create option stands for a new group named after the Google group. */
function toSelectedGroupOptions(row: GoogleGroupRow, createGroupOption: Option): Option[] {
  if (!row.syncsMembers) return [];
  if (row.groupId && row.groupName) return [{ value: row.groupId, label: row.groupName }];

  return [createGroupOption];
}

function RemoveRowButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();

  return (
    <Button
      size="icon"
      variant="ghost"
      className="size-8"
      onClick={onClick}
      aria-label={t("directorySync.groupMappings.remove")}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}

/** Removing a synced group freezes its members instead of removing them. */
function RemoveSyncedGroupDialog({
  groupName,
  onConfirm,
}: {
  groupName: string;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const removeSyncedGroup = () => {
    onConfirm();
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label={t("directorySync.groupMappings.remove")}
        >
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("directorySync.groupMappings.removeTitle", { name: groupName })}
          </DialogTitle>
          <DialogDescription>
            {t("directorySync.groupMappings.removeDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {t("common.button.cancel")}
          </Button>
          <Button variant="destructive" onClick={removeSyncedGroup}>
            {t("directorySync.groupMappings.remove")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Role mappings come first in their saved priority order; groups only synced follow. */
function toGoogleGroupRows(connection: DirectorySyncConnection): GoogleGroupRow[] {
  const groupMappingsByExternalId = new Map(
    connection.groupMappings.map((groupMapping) => [groupMapping.externalGroupId, groupMapping]),
  );
  const roleMappings = [...connection.roleMappings].sort(
    (first, second) => first.priority - second.priority,
  );
  const roleMappedExternalIds = new Set(
    roleMappings.map((roleMapping) => roleMapping.externalGroupId),
  );

  const rowsWithRole = roleMappings.map((roleMapping) => {
    const groupMapping = groupMappingsByExternalId.get(roleMapping.externalGroupId);

    return {
      externalGroupId: roleMapping.externalGroupId,
      externalGroupEmail: roleMapping.externalGroupEmail,
      externalGroupName: roleMapping.externalGroupEmail,
      roleId: roleMapping.roleId,
      syncsMembers: Boolean(groupMapping),
      groupId: groupMapping?.groupId ?? null,
      groupName: groupMapping?.groupName ?? null,
    };
  });

  const rowsOnlySyncingMembers = connection.groupMappings
    .filter((groupMapping) => !roleMappedExternalIds.has(groupMapping.externalGroupId))
    .map((groupMapping) => ({
      externalGroupId: groupMapping.externalGroupId,
      externalGroupEmail: groupMapping.externalGroupEmail,
      externalGroupName: groupMapping.externalGroupEmail,
      roleId: null,
      syncsMembers: true,
      groupId: groupMapping.groupId,
      groupName: groupMapping.groupName,
    }));

  return [...rowsWithRole, ...rowsOnlySyncingMembers];
}
