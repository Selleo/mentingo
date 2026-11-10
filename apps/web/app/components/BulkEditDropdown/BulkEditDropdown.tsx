import { CopyPlus, MoreVertical } from "lucide-react";
import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
          "flex flex-col gap-0.5 rounded-lg border border-neutral-200 bg-white p-1 text-neutral-900 shadow-lg",
          {
            "w-52": iconOnly,
            "w-60": !iconOnly,
          },
        )}
        align="end"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {dropdownItems.map((item, index) => (
          <Fragment key={item.translationKey}>
            {item.destructive && index > 0 && !dropdownItems[index - 1].destructive && (
              <DropdownMenuSeparator className="bg-neutral-200" />
            )}
            <DropdownMenuItem
              data-testid={item.testId}
              className={cn(
                "flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-sm font-medium outline-none transition-colors",
                {
                  "text-neutral-800 focus:bg-neutral-100 focus:text-neutral-950": !item.destructive,
                  "text-error-700 focus:bg-error-50 focus:text-error-700": item.destructive,
                },
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
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
