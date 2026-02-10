import { camelCase } from "lodash-es";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import MultipleSelector from "~/components/ui/multiselect";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useGroupsOptions } from "~/hooks/useGroupsOptions";
import { ConfirmationModal } from "~/modules/Admin/Users/components/ConfirmationModal";

import type { BulkAssignUsersToGroupBody } from "~/api/generated-api";
import type { CheckboxState, Option } from "~/components/ui/multiselect";
import type { UserRole } from "~/config/userRoles";

type GroupData = {
  id: string;
  name: string;
}[];

interface EditModalProps {
  onConfirm: (payload?: BulkAssignUsersToGroupBody) => void;
  onCancel: () => void;
  type: string;
  groupData: GroupData;
  roleData: UserRole[];
  selectedUsers: BulkAssignUsersToGroupBody;
  selectedValue: string;
  setSelectedValue: (value: string) => void;
  checkboxStates?: CheckboxState[];
}

type RoleItem = UserRole;

const getInitiallySelected = (value: CheckboxState[], groupData: GroupData) => {
  return value
    .filter((group) => group.state === true)
    .map<Option>((group) => {
      const currentGroup = groupData.find((data) => data.id === group.id);
      return { value: group.id, label: currentGroup?.name ?? group.id };
    });
};

export const EditModal = ({
  onConfirm,
  onCancel,
  type,
  roleData,
  groupData,
  selectedUsers,
  selectedValue,
  setSelectedValue,
  checkboxStates,
}: EditModalProps) => {
  const { t } = useTranslation();

  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  const { selectedGroups, setSelectedGroups, filterGroups, options } = useGroupsOptions(groupData);
  const [groupCheckboxStates, setGroupCheckboxStates] = useState<CheckboxState[]>(
    checkboxStates ?? [],
  );

  useEffect(() => {
    if (type !== "group") {
      setGroupCheckboxStates(checkboxStates ?? []);
      setSelectedGroups([]);
      return;
    }

    const calculatedStates = groupData.map<CheckboxState>((group) => {
      const usersWithGroup = selectedUsers.filter((user) => user.groups.includes(group.id)).length;

      const state: CheckboxState["state"] =
        usersWithGroup === selectedUsers.length
          ? true
          : usersWithGroup === 0
            ? false
            : "indeterminate";

      return { id: group.id, state };
    });

    setGroupCheckboxStates(calculatedStates);
    setSelectedGroups(getInitiallySelected(calculatedStates, groupData));
  }, [checkboxStates, groupData, selectedUsers, setSelectedGroups, type]);

  const usersWithUpdatedGroups = useMemo(() => {
    if (type !== "group") return selectedUsers;

    return selectedUsers.map((user) => ({
      userId: user.userId,
      groups: groupCheckboxStates
        .filter(
          (group) =>
            group.state === true ||
            (group.state === "indeterminate" && user.groups.includes(group.id)),
        )
        .map((group) => group.id),
    }));
  }, [groupCheckboxStates, selectedUsers, type]);

  const handleGroupsChange = (updatedOptions: Option[]) => {
    const previousSelection = new Set(selectedGroups.map((group) => group.value));
    const nextSelection = new Set(updatedOptions.map((group) => group.value));

    setGroupCheckboxStates((prev) =>
      prev.map((group) => {
        if (nextSelection.has(group.id)) {
          return { ...group, state: true };
        }

        if (previousSelection.has(group.id) && !nextSelection.has(group.id)) {
          return { ...group, state: false };
        }

        return group;
      }),
    );

    setSelectedGroups(updatedOptions);
  };

  const handleValueChange = (value: string) => {
    setSelectedValue(value);
  };

  const items: RoleItem[] | undefined = type === "group" ? undefined : roleData;

  const getLabel = (item: RoleItem) => {
    if (!item) return "";

    return t(`common.roles.${camelCase(item as string)}`) as string;
  };

  const handleSubmit = () =>
    type === "delete" || type === "archive" ? onConfirm() : setShowConfirmationModal(true);

  const confirmationName =
    type === "group"
      ? selectedGroups.map((group) => group.label).join(", ")
      : getLabel(selectedValue as RoleItem);

  const renderContent = () => {
    switch (type) {
      case "delete":
      case "archive":
        return t(`adminUsersView.modal.description.${type}`);

      case "group":
        return (
          <MultipleSelector
            value={selectedGroups}
            options={options}
            checkboxStates={groupCheckboxStates}
            onChange={handleGroupsChange}
            placeholder={t("adminGroupsView.groupSelect.label")}
            hidePlaceholderWhenSelected
            hideClearAllButton
            className="w-full bg-background p-2"
            badgeClassName="bg-accent text-accent-foreground text-sm hover:bg-accent"
            commandProps={{
              label: t("adminGroupsView.groupSelect.label"),
              filter: filterGroups,
            }}
            inputProps={{
              className: "w-full outline-none py-0 body-base",
            }}
          />
        );

      default:
        return (
          <Select onValueChange={handleValueChange} value={selectedValue}>
            <SelectTrigger className="w-full rounded-md border border-neutral-300 px-2 py-1">
              <SelectValue
                placeholder={t(`adminUsersView.modal.placeholder.${type}`)}
                className="capitalize"
              />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {items?.map((item: RoleItem) => (
                  <SelectItem className="capitalize" value={item} key={item}>
                    {getLabel(item)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        );
    }
  };

  return (
    <>
      {showConfirmationModal && (
        <ConfirmationModal
          open={showConfirmationModal}
          onCancel={() => setShowConfirmationModal(false)}
          onConfirm={() => onConfirm(usersWithUpdatedGroups)}
          selectedUsers={selectedUsers.length}
          type={type}
          name={confirmationName}
        />
      )}
      <Dialog open={Boolean(type)} onOpenChange={onCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t(`adminUsersView.modal.title.${type}`)} ({selectedUsers.length ?? 0})
            </DialogTitle>

            <DialogDescription>{renderContent()}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <DialogFooter className="z-50">
              <Button variant="outline" onClick={onCancel}>
                {t("common.button.cancel")}
              </Button>
              <Button
                onClick={handleSubmit}
                variant={type === "delete" ? "destructive" : "primary"}
                disabled={!selectedUsers || (type === "role" && !selectedValue)}
              >
                {t(`adminUsersView.modal.button.${type}`)}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
