import { CERTIFICATE_RESET_SCOPES } from "@repo/shared";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Pagination } from "~/components/Pagination/Pagination";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

import type {
  CertificateResetGroup,
  CertificateResetScope,
  CertificateResetUser,
} from "./CertificateResetDialog.types";
import type { ItemsPerPageOption } from "~/components/Pagination/Pagination";

type CertificateResetDialogProps = {
  open: boolean;
  resetScope: CertificateResetScope;
  groups: CertificateResetGroup[];
  users: CertificateResetUser[];
  usersTotalItems: number;
  usersPage: number;
  usersPerPage: ItemsPerPageOption;
  usersSearch: string;
  isLoadingUsers: boolean;
  selectedGroupIds: string[];
  selectedUserIds: string[];
  disabledScopes: Record<CertificateResetScope, boolean>;
  sendResetEmail: boolean;
  canSubmitReset: boolean;
  isResettingCertificates: boolean;
  onOpenChange: (open: boolean) => void;
  onResetScopeChange: (scope: CertificateResetScope) => void;
  onToggleGroup: (groupId: string) => void;
  onToggleUser: (userId: string) => void;
  onUsersPageChange: (page: number) => void;
  onUsersPerPageChange: (perPage: string) => void;
  onUsersSearchChange: (search: string) => void;
  onSendResetEmailChange: (value: boolean) => void;
  onSubmit: () => void;
};

const getScopeOptionClassName = ({
  isDisabled,
  isSelected,
}: {
  isDisabled: boolean;
  isSelected: boolean;
}) =>
  match({ isDisabled, isSelected })
    .with({ isDisabled: true }, () => "cursor-not-allowed border-neutral-200 text-neutral-400")
    .with({ isSelected: true }, () => "border-neutral-950 bg-neutral-50 text-neutral-950")
    .otherwise(() => "border-neutral-300 text-neutral-700 hover:bg-neutral-50");

export function CertificateResetDialog({
  open,
  resetScope,
  groups,
  users,
  usersTotalItems,
  usersPage,
  usersPerPage,
  usersSearch,
  isLoadingUsers,
  selectedGroupIds,
  selectedUserIds,
  disabledScopes,
  sendResetEmail,
  canSubmitReset,
  isResettingCertificates,
  onOpenChange,
  onResetScopeChange,
  onToggleGroup,
  onToggleUser,
  onUsersPageChange,
  onUsersPerPageChange,
  onUsersSearchChange,
  onSendResetEmailChange,
  onSubmit,
}: CertificateResetDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <div className="space-y-5">
          <DialogHeader>
            <DialogTitle>{t("adminCourseView.settings.other.resetCertificates")}</DialogTitle>
            <DialogDescription>
              {t("adminCourseView.settings.other.resetCertificatesDialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <RadioGroup
            value={resetScope}
            onValueChange={onResetScopeChange}
            className="grid gap-3 md:grid-cols-3"
          >
            {Object.values(CERTIFICATE_RESET_SCOPES).map((scope) => {
              const isSelected = resetScope === scope;
              const isDisabled = disabledScopes[scope];

              return (
                <Label
                  key={scope}
                  className={`flex items-center gap-2 rounded-md border p-3 text-sm transition-colors ${getScopeOptionClassName(
                    { isDisabled, isSelected },
                  )}`}
                >
                  <RadioGroupItem value={scope} disabled={isDisabled} />
                  <span>{t(`adminCourseView.settings.other.resetScope.${scope}`)}</span>
                </Label>
              );
            })}
          </RadioGroup>

          {resetScope === CERTIFICATE_RESET_SCOPES.GROUPS && (
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-neutral-200 p-2">
              {groups.map((group) => (
                <Label
                  key={group.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-neutral-800 transition-colors hover:bg-neutral-50"
                >
                  <Checkbox
                    checked={selectedGroupIds.includes(group.id)}
                    onCheckedChange={() => onToggleGroup(group.id)}
                  />
                  <span className="min-w-0 flex-1 truncate">{group.name}</span>
                  <span className="shrink-0 text-xs text-neutral-500">
                    {t("adminCourseView.settings.other.activeCertificateCount", {
                      count: group.activeCertificateCount,
                    })}
                  </span>
                </Label>
              ))}
            </div>
          )}

          {resetScope === CERTIFICATE_RESET_SCOPES.USERS && (
            <div className="space-y-5 pt-2 pb-1">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
                <Input
                  value={usersSearch}
                  onChange={(event) => onUsersSearchChange(event.target.value)}
                  placeholder={t("adminCourseView.settings.other.resetUsersSearchPlaceholder")}
                  className="pl-9"
                />
              </div>

              <div className="overflow-hidden rounded-md border border-neutral-200">
                <Table className="bg-white">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12" />
                      <TableHead>{t("adminCourseView.settings.other.resetUsersStudent")}</TableHead>
                      <TableHead>{t("adminCourseView.settings.other.resetUsersEmail")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const isSelected = selectedUserIds.includes(user.id);

                      return (
                        <TableRow
                          key={user.id}
                          data-state={isSelected && "selected"}
                          className="cursor-pointer hover:bg-neutral-100"
                          onClick={() => onToggleUser(user.id)}
                        >
                          <TableCell className="w-12">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => onToggleUser(user.id)}
                              onClick={(event) => event.stopPropagation()}
                              aria-label={`${user.firstName} ${user.lastName}`}
                            />
                          </TableCell>
                          <TableCell className="text-neutral-950">
                            {user.firstName} {user.lastName}
                          </TableCell>
                          <TableCell className="text-neutral-700">{user.email}</TableCell>
                        </TableRow>
                      );
                    })}
                    {isLoadingUsers && (
                      <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center text-neutral-600">
                          {t("adminCourseView.settings.other.resetUsersLoading")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <Pagination
                  className="border-t bg-white"
                  emptyDataClassName="border-t bg-white"
                  totalItems={usersTotalItems}
                  itemsPerPage={usersPerPage}
                  currentPage={usersPage}
                  onPageChange={onUsersPageChange}
                  onItemsPerPageChange={onUsersPerPageChange}
                />
              </div>
            </div>
          )}

          <Label className="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-200 p-3 text-sm text-neutral-800">
            <Checkbox
              checked={sendResetEmail}
              onCheckedChange={(value) => onSendResetEmailChange(Boolean(value))}
            />
            <span>{t("adminCourseView.settings.other.sendResetEmail")}</span>
          </Label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.button.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!canSubmitReset || isResettingCertificates}
              onClick={onSubmit}
            >
              {t("adminCourseView.settings.button.resetCertificates")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
