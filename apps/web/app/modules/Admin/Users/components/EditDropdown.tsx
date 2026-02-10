import { DropdownMenu } from "@radix-ui/react-dropdown-menu";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

import type { IconName } from "~/types/shared";

export type DropdownItems = {
  icon: IconName;
  translationKey: string;
  action: () => void;
  destructive: boolean;
};

interface EditDropdownProps {
  dropdownItems: DropdownItems[];
  disabled: boolean;
}

export const EditDropdown = ({ dropdownItems, disabled }: EditDropdownProps) => {
  const { t } = useTranslation();

  const [openDropdown, setOpenDropdown] = useState(false);

  return (
    <DropdownMenu onOpenChange={(open) => setOpenDropdown(open)}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex gap-2" disabled={disabled}>
          {t("adminUsersView.button.bulkEdit")}
          <Icon className="size-4 text-black" name={openDropdown ? "ArrowUp" : "ArrowDown"} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-64 rounded bg-white p-2 text-black shadow-lg transition-all duration-200">
        {dropdownItems.map((item) => {
          return (
            <DropdownMenuItem key={item.translationKey}>
              <Button
                className={cn(
                  "body-sm w-full justify-start gap-2 text-neutral-950 hover:text-neutral-950",
                  { "text-error-700 hover:text-error-700": item.destructive },
                )}
                onClick={item.action}
                variant="ghost"
              >
                <Icon
                  name={item.icon}
                  className={cn("size-4 text-accent-foreground", {
                    "text-error-700 hover:text-error-700": item.destructive,
                  })}
                />
                {t(item.translationKey)}
              </Button>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
