import { Settings, Trash2, Power, PowerOff, MoreVertical } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

import type { FC } from "react";

interface ActionMenuProps {
  automationId: string;
  status: "Enabled" | "Disabled" | "Draft";
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}

export const ActionMenu: FC<ActionMenuProps> = ({
  automationId,
  status,
  onToggleStatus,
  onDelete,
  onEdit,
}) => {
  const { t } = useTranslation();
  const isEnabled = status === "Enabled";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <MoreVertical className="size-4" />
          <span className="sr-only">{t("automationView.actionMenu.openMenu")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => onEdit(automationId)}
          className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm"
        >
          <Settings className="size-4 text-muted-foreground" />
          {t("automationView.actionMenu.settingsAndEdit")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onToggleStatus(automationId)}
          className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm"
        >
          {isEnabled ? (
            <>
              <PowerOff className="size-4 text-warning-500" />
              {t("automationView.actionMenu.disable")}
            </>
          ) : (
            <>
              <Power className="size-4 text-success-500" />
              {t("automationView.actionMenu.enable")}
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onDelete(automationId)}
          className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-error-600 focus:text-error-600"
        >
          <Trash2 className="size-4" />
          {t("automationView.actionMenu.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
