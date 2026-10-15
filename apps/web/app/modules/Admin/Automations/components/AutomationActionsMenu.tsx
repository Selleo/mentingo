import { useNavigate } from "@remix-run/react";
import { AUTOMATION_STATUSES } from "@repo/shared";
import { Archive, Copy, MoreVertical, Power, PowerOff, Trash2, Workflow } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useArchiveAutomation } from "~/api/mutations/automations/useArchiveAutomation";
import { useDeleteAutomation } from "~/api/mutations/automations/useDeleteAutomation";
import { useDisableAutomation } from "~/api/mutations/automations/useDisableAutomation";
import { useDuplicateAutomation } from "~/api/mutations/automations/useDuplicateAutomation";
import { useEnableAutomation } from "~/api/mutations/automations/useEnableAutomation";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

import { DeleteAutomationDialog } from "./DeleteAutomationDialog";

import type { AutomationDto } from "@repo/shared";

const menuItemClassName =
  "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

export function AutomationActionsMenu({ automation }: { automation: AutomationDto }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { mutateAsync: deleteAutomation, isPending: isDeleting } = useDeleteAutomation();
  const { mutateAsync: enableAutomation, isPending: isEnabling } = useEnableAutomation();
  const { mutateAsync: disableAutomation, isPending: isDisabling } = useDisableAutomation();
  const { mutateAsync: archiveAutomation, isPending: isArchiving } = useArchiveAutomation();
  const { mutateAsync: duplicateAutomation, isPending: isDuplicating } = useDuplicateAutomation();
  const isBusy = isEnabling || isDisabling || isArchiving || isDuplicating || isDeleting;
  const isArchived = automation.status === AUTOMATION_STATUSES.ARCHIVED;
  const isEnabled = automation.status === AUTOMATION_STATUSES.ENABLED;
  const cannotEnable = automation.hasUnappliedChanges || !automation.appliedDefinition;

  async function toggleAutomationStatus() {
    if (isEnabled) {
      await disableAutomation(automation.id);

      return;
    }

    await enableAutomation(automation.id);
  }

  async function duplicateAutomationAndOpenEditor() {
    const duplicate = await duplicateAutomation(automation.id);

    navigate(`/admin/automations/${duplicate.id}`);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={isBusy}
            aria-label={t("automationView.table.manage")}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 space-y-1 p-2">
          <DropdownMenuItem
            className={menuItemClassName}
            onSelect={() => navigate(`/admin/automations/${automation.id}`)}
          >
            <Workflow className="size-4" />
            {t("automationView.drawer.openBuilder")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className={menuItemClassName}
            disabled={isBusy || isArchived || (!isEnabled && cannotEnable)}
            onSelect={() => void toggleAutomationStatus().catch(() => undefined)}
          >
            {isEnabled ? <PowerOff className="size-4" /> : <Power className="size-4" />}
            {t(isEnabled ? "automations.disable" : "automations.enable")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className={menuItemClassName}
            disabled={isBusy}
            onSelect={() => void duplicateAutomationAndOpenEditor().catch(() => undefined)}
          >
            <Copy className="size-4" />
            {t("automations.duplicate")}
          </DropdownMenuItem>
          {automation.hasUnappliedChanges && (
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {t("automations.unapplied")}
            </DropdownMenuLabel>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className={cn(
              menuItemClassName,
              "text-error-700 focus:bg-error-50 focus:text-error-700",
            )}
            disabled={isBusy || isArchived}
            onSelect={() => void archiveAutomation(automation.id).catch(() => undefined)}
          >
            <Archive className="size-4" />
            {t("automations.archive")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className={cn(
              menuItemClassName,
              "text-error-700 focus:bg-error-50 focus:text-error-700",
            )}
            disabled={isBusy}
            onSelect={() => setIsDeleteDialogOpen(true)}
          >
            <Trash2 className="size-4" />
            {t("automationView.deleteDialog.confirm")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteAutomationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        isDeleting={isDeleting}
        onConfirm={() => {
          void deleteAutomation(automation.id)
            .then(() => setIsDeleteDialogOpen(false))
            .catch(() => undefined);
        }}
      />
    </>
  );
}
