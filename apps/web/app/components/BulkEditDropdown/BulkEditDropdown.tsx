import { CopyPlus, MoreVertical } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

import type { ReactNode } from "react";
import type { IconName } from "~/types/shared";

export type BulkEditDropdownItem = {
  iconName?: IconName;
  icon?: ReactNode;
  translationKey: string;
  action: () => void;
  destructive: boolean;
  testId: string;
};

interface BulkEditDropdownProps {
  dropdownItems: BulkEditDropdownItem[];
  disabled: boolean;
  triggerTestId?: string;
  triggerTranslationKey?: string;
  triggerAriaLabel?: string;
  iconOnly?: boolean;
  stopTriggerPropagation?: boolean;
}

export const BulkEditDropdown = ({
  dropdownItems,
  disabled,
  triggerTestId,
  triggerTranslationKey = "adminUsersView.button.bulkEdit",
  triggerAriaLabel,
  iconOnly = false,
  stopTriggerPropagation = false,
}: BulkEditDropdownProps) => {
  const { t } = useTranslation();

  const [openDropdown, setOpenDropdown] = useState(false);

  return (
    <DropdownMenu onOpenChange={(open) => setOpenDropdown(open)}>
      <DropdownMenuTrigger asChild>
        <Button
          data-testid={triggerTestId}
          variant={iconOnly ? "ghost" : "outline"}
          size={iconOnly ? "icon" : "default"}
          className={cn("flex gap-2", { "size-9 p-0": iconOnly })}
          disabled={disabled}
          aria-label={triggerAriaLabel ?? (iconOnly ? t(triggerTranslationKey) : undefined)}
          onClick={stopTriggerPropagation ? (event) => event.stopPropagation() : undefined}
        >
          {iconOnly ? (
            <MoreVertical className="size-4" aria-hidden="true" />
          ) : (
            <CopyPlus className="size-4" />
          )}
          {!iconOnly && t(triggerTranslationKey)}
          {!iconOnly && (
            <Icon className="size-4 text-black" name={openDropdown ? "ArrowUp" : "ArrowDown"} />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className={cn(
          "flex flex-col gap-1 rounded bg-white p-2 text-black shadow-lg transition-all duration-200",
          {
            "w-64": iconOnly,
            "w-80": !iconOnly,
          },
        )}
        align="end"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {dropdownItems.map((item) => (
          <DropdownMenuItem
            key={item.translationKey}
            data-testid={item.testId}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-neutral-900 outline-none focus:bg-accent focus:text-accent-foreground",
              { "text-error-700 focus:bg-error-50 focus:text-error-700": item.destructive },
            )}
            onSelect={item.action}
          >
            <span className="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4">
              {item.iconName ? (
                <Icon name={item.iconName} className="size-4" aria-hidden="true" />
              ) : (
                item.icon
              )}
            </span>
            <span className="min-w-0 truncate">{t(item.translationKey)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
