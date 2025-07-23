import { camelCase } from "lodash-es";
import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ConfirmationModal } from "~/modules/Admin/Users/components/ConfirmationModal";

import type { UserRole } from "~/config/userRoles";

interface EditModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  type: string;
  groupData: {
    groupName: string;
    groupId: string;
  }[];
  roleData: UserRole[];
  selectedUsers: number;
  selectedValue: string;
  setSelectedValue: (value: string) => void;
}

type GroupItem = { groupName: string; groupId: string };
type RoleItem = UserRole;

export const EditModal = ({
  onConfirm,
  onCancel,
  type,
  roleData,
  groupData,
  selectedUsers,
  selectedValue,
  setSelectedValue,
}: EditModalProps) => {
  const { t } = useTranslation();

  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  const handleValueChange = (value: string) => {
    setSelectedValue(value);
  };

  const items = type === "group" ? groupData : roleData;
  const getLabel = (item: GroupItem | RoleItem) =>
    type === "group"
      ? (item as GroupItem).groupName
      : (t(`common.roles.${camelCase(item as string)}`) as string);

  const getValue = (item: GroupItem | RoleItem) =>
    type === "group" ? (item as GroupItem).groupId : (item as string);

  const handleSubmit = () => (type === "delete" ? onConfirm() : setShowConfirmationModal(true));

  return (
    <>
      {showConfirmationModal && (
        <ConfirmationModal
          open={showConfirmationModal}
          onCancel={() => setShowConfirmationModal(false)}
          onConfirm={onConfirm}
          selectedUsers={selectedUsers ?? 0}
          type={type}
          name={getLabel(items.find((item) => getValue(item) === selectedValue)!)}
        />
      )}
      <Dialog open={Boolean(type)} onOpenChange={onCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t(`adminUsersView.modal.title.${type}`)} ({selectedUsers ?? 0})
            </DialogTitle>

            <DialogDescription>
              {type === "delete" ? (
                t(`adminUsersView.modal.description.${type}`)
              ) : (
                <Select onValueChange={handleValueChange} value={selectedValue}>
                  <SelectTrigger className="w-full rounded-md border border-neutral-300 px-2 py-1">
                    <SelectValue
                      placeholder={t(`adminUsersView.modal.placeholder.${type}`)}
                      className="capitalize"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {items?.map((item) => (
                        <SelectItem
                          className="capitalize"
                          value={getValue(item)}
                          key={getValue(item)}
                        >
                          {getLabel(item)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onCancel}>
              {t("common.button.cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              variant={`${type === "delete" ? "destructive" : "primary"}`}
              disabled={!selectedUsers}
            >
              {t(`adminUsersView.modal.button.${type}`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
