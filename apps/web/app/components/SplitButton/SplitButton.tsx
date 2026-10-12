import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

import type { ReactNode } from "react";

type SplitButtonProps = {
  children: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  secondaryLabel: ReactNode;
  secondaryIcon?: ReactNode;
  secondaryDisabled?: boolean;
  menuAriaLabel: string;
  className?: string;
  onClick: () => void;
  onSecondaryClick: () => void;
};

export function SplitButton({
  children,
  icon,
  disabled,
  secondaryLabel,
  secondaryIcon,
  secondaryDisabled,
  menuAriaLabel,
  className,
  onClick,
  onSecondaryClick,
}: SplitButtonProps) {
  const controlsRef = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuWidth, setMenuWidth] = useState<number>();

  return (
    <div
      ref={controlsRef}
      className={cn("grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center", className)}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none invisible col-span-2 col-start-1 row-start-1 flex h-0 items-center justify-center gap-2 whitespace-nowrap px-3 text-sm font-medium"
      >
        {secondaryIcon}
        {secondaryLabel}
      </span>
      <Button
        type="button"
        variant="primary"
        className={cn("col-start-1 row-start-1 gap-2 whitespace-nowrap rounded-r-none", {
          "rounded-bl-none": isMenuOpen,
        })}
        disabled={disabled}
        onClick={onClick}
      >
        {icon}
        {children}
      </Button>
      <DropdownMenu
        open={isMenuOpen}
        onOpenChange={(isOpen) => {
          setIsMenuOpen(isOpen);
          if (isOpen) setMenuWidth(controlsRef.current?.getBoundingClientRect().width);
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="primary"
            className={cn("col-start-2 row-start-1 rounded-l-none border-l border-white/25 px-2", {
              "rounded-br-none": isMenuOpen,
            })}
            disabled={secondaryDisabled}
            aria-label={menuAriaLabel}
          >
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="bottom"
          sideOffset={0}
          avoidCollisions={false}
          style={{ width: menuWidth }}
          className="min-w-0 rounded-t-none rounded-b-lg border-0 bg-transparent p-0 shadow-none"
        >
          <DropdownMenuItem
            className="flex h-9 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-t-none rounded-b-lg border border-input bg-background px-3 text-sm font-medium text-primary-800 outline-none transition-colors hover:border-primary-500 focus:border-primary-500 focus:bg-primary-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
            disabled={secondaryDisabled}
            onSelect={onSecondaryClick}
          >
            {secondaryIcon}
            {secondaryLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
