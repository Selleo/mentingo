import { Check, ChevronsUpDown } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

import type { ReactNode } from "react";

interface AutomationSearchSelectProps {
  value: string;
  label: string;
  placeholder: string;
  disabled?: boolean;
  groups: {
    label?: string;
    options: { value: string; label: string; description?: string; disabled?: boolean }[];
  }[];
  onValueChange: (value: string) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  footer?: ReactNode;
  emptyMessage?: string;
}

export function AutomationSearchSelect(props: AutomationSearchSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const selected = props.groups
    .flatMap((group) => group.options)
    .find((option) => option.value === props.value);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        // Keep nested lists inside the dialog's focus and scroll-lock boundary.
        setPortalContainer(triggerRef.current?.closest<HTMLElement>('[role="dialog"]') ?? null);
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={props.label}
          disabled={props.disabled}
          className="w-full justify-between gap-2 font-normal"
        >
          <span className="truncate">{selected?.label ?? props.placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        portalContainer={portalContainer}
        align="start"
        sideOffset={10}
        collisionPadding={8}
        className="pointer-events-auto z-[60] max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
      >
        <Command
          shouldFilter={!props.onSearchChange}
          className="h-auto [&_[cmdk-input]]:outline-none"
        >
          <CommandInput
            value={props.searchValue}
            onValueChange={props.onSearchChange}
            placeholder={t("globalSearch.search")}
            aria-label={props.label}
            className="outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
          />
          <CommandList className="max-h-[min(20rem,calc(var(--radix-popover-content-available-height)-4rem))] overflow-y-auto">
            <CommandEmpty>
              {props.emptyMessage ?? t("automationBuilder.creation.noResults")}
            </CommandEmpty>
            {props.groups.map((group, index) => (
              <CommandGroup key={group.label ?? index} heading={group.label}>
                {group.options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    keywords={[option.label, option.description ?? ""]}
                    disabled={props.disabled || option.disabled}
                    onSelect={() => {
                      props.onValueChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {option.label}
                      {option.description && (
                        <span className="text-xs text-neutral-500">
                          {" · "}
                          {option.description}
                        </span>
                      )}
                    </span>
                    {option.value === props.value && (
                      <Check className="size-4 shrink-0 text-primary-700" aria-hidden="true" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
          {props.footer}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
