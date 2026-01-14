import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useTransferCourseOwnership } from "~/api/mutations/admin/useTransferCourseOwnership";
import { Icon } from "~/components/Icon";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import TransferOwnershipDialog from "./TransferOwnershipDialog";

import type { GetCourseOwnershipResponse } from "~/api/generated-api";

interface TransferOwnershipProps {
  courseId: string;
  candidates?: GetCourseOwnershipResponse["possibleCandidates"];
}

const TransferOwnership = ({ courseId, candidates }: TransferOwnershipProps) => {
  const { t } = useTranslation();

  const { mutateAsync: transferCourseOwnership } = useTransferCourseOwnership();

  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const selectedUser = useMemo(
    () => candidates?.find((user) => user.id === selectedUserId),
    [selectedUserId, candidates],
  );
  const selectedUserLabel = selectedUser ? `${selectedUser.name} (${selectedUser.email})` : "";

  const onTransfer = async () => {
    await transferCourseOwnership({ courseId, userId: selectedUserId }).then(() =>
      setSelectedUserId(""),
    );
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100">
          <Icon name="User" className="h-5 w-5 text-neutral-600" />
        </div>
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold text-neutral-900">
              {t("adminCourseView.settings.transferOwnership.title")}
            </h3>
            <p className="text-sm text-neutral-500">
              {t("adminCourseView.settings.transferOwnership.description")}
            </p>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label htmlFor="transfer-owner" className="mb-1.5 block text-sm font-medium">
                {t("adminCourseView.settings.transferOwnership.label")}
              </Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger id="transfer-owner" className="w-full">
                  <SelectValue
                    placeholder={t("adminCourseView.settings.transferOwnership.placeholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {candidates?.map((user) => (
                    <SelectItem value={user.id} key={user.id}>
                      <div className="flex flex-col items-start text-left">
                        <span className="font-medium">{user.name}</span>
                        <span className="text-xs text-neutral-500">{user.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <TransferOwnershipDialog
              selectedUserLabel={selectedUserLabel}
              isDisabled={!selectedUserId}
              onConfirm={onTransfer}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransferOwnership;
