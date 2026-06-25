import { CopyCheck } from "lucide-react";
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
}

export const BulkEditDropdown = ({
  dropdownItems,
  disabled,
  triggerTestId,
  triggerTranslationKey = "adminUsersView.button.bulkEdit",
}: BulkEditDropdownProps) => {
  const { t } = useTranslation();

  const [openDropdown, setOpenDropdown] = useState(false);

  return (
    <DropdownMenu onOpenChange={(open) => setOpenDropdown(open)}>
      <DropdownMenuTrigger asChild>
        <Button
          data-testid={triggerTestId}
          variant="outline"
          className="flex gap-2"
          disabled={disabled}
        >
          <CopyCheck className="size-4" />
          {t(triggerTranslationKey)}
          <Icon className="size-4 text-black" name={openDropdown ? "ArrowUp" : "ArrowDown"} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-80 rounded bg-white p-2 text-black shadow-lg transition-all duration-200"
        align="end"
      >
        {dropdownItems.map((item) => (
          <DropdownMenuItem key={item.translationKey}>
            <Button
              data-testid={item.testId}
              className={cn(
                "body-sm w-full min-w-0 justify-start gap-3 text-neutral-950 hover:text-neutral-950",
                { "text-error-700 hover:text-error-700": item.destructive },
              )}
              onClick={item.action}
              variant="ghost"
            >
              <span className="flex size-5 shrink-0 items-center justify-center [&>svg]:size-4 [&>svg]:shrink-0">
                {item.iconName ? (
                  <Icon
                    name={item.iconName}
                    className={cn("size-4 shrink-0 text-accent-foreground", {
                      "text-error-700 hover:text-error-700": item.destructive,
                    })}
                  />
                ) : (
                  item.icon
                )}
              </span>
              <span className="min-w-0 truncate">{t(item.translationKey)}</span>
            </Button>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
