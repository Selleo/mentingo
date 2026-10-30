import { Check, ChevronDown, Plus } from "lucide-react";
import { useId, useRef, useState } from "react";
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
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

export type CompetenciesSelectOption = { value: string; label: string; description?: string };

export type CompetenciesSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: CompetenciesSelectOption[];
  emptyLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  hideLabel?: boolean;
  className?: string;
  createAction?: { label: string; onSelect: () => void };
  /** Label of the selected value when it is not among the loaded options. */
  selectedLabel?: string;
  /** Searches on the server instead of filtering the loaded options. */
  onSearchChange?: (search: string) => void;
};

export function CompetenciesSelect({
  label,
  value,
  onChange,
  options,
  emptyLabel,
  placeholder,
  disabled,
  hideLabel = false,
  className,
  createAction,
  selectedLabel,
  onSearchChange,
}: CompetenciesSelectProps) {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<CompetenciesSelectOption>();
  const triggerRef = useRef<HTMLElement | null>(null);
  const selected =
    options.find((option) => option.value === value) ??
    (chosen?.value === value ? chosen : undefined);
  const triggerLabel = selected?.label ?? (value ? selectedLabel : emptyLabel);
  const changeSearch = (next: string) => {
    setSearch(next);
    onSearchChange?.(next);
  };
  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next && search) changeSearch("");
  };
  const choose = (next: string) => {
    setChosen(options.find((option) => option.value === next));
    onChange(next);
    changeOpen(false);
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <Label htmlFor={id} className={cn(hideLabel && "sr-only")}>
        {label}
      </Label>
      <Popover open={open} onOpenChange={changeOpen} modal>
        <PopoverTrigger asChild>
          <Button
            ref={(node) => {
              triggerRef.current = node;
            }}
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={hideLabel ? label : undefined}
            disabled={disabled}
            onClick={(event) => event.stopPropagation()}
            className={cn(
              "h-[42px] w-full justify-between gap-2 border-neutral-300 bg-white px-3 font-normal text-neutral-950 hover:border-primary-500 hover:text-neutral-950",
              !triggerLabel && "text-neutral-600",
            )}
          >
            <span className="min-w-0 flex-1 truncate text-left">
              {triggerLabel ?? placeholder ?? label}
            </span>
            <ChevronDown className="size-4 shrink-0 text-neutral-700" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          onClick={(event) => event.stopPropagation()}
          onPointerDownOutside={(event) => {
            if (triggerRef.current?.contains(event.target as Node)) event.preventDefault();
          }}
          align="start"
          className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0"
        >
          <Command className="[&_[cmdk-input]]:outline-none" shouldFilter={!onSearchChange}>
            <CommandInput
              value={search}
              onValueChange={changeSearch}
              placeholder={t("competencies.select.search")}
              className="outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
            />
            <CommandList>
              <CommandEmpty>{t("competencies.select.noResults")}</CommandEmpty>
              <CommandGroup>
                {emptyLabel && (
                  <CommandItem value={`__none__ ${emptyLabel}`} onSelect={() => choose("")}>
                    <span className="min-w-0 flex-1 truncate">{emptyLabel}</span>
                    {!value && <Check className="size-4 text-primary-700" aria-hidden="true" />}
                  </CommandItem>
                )}
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.value}`}
                    onSelect={() => choose(option.value)}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{option.label}</span>
                      {option.description && (
                        <span className="details truncate text-neutral-700">
                          {option.description}
                        </span>
                      )}
                    </span>
                    {option.value === value && (
                      <Check className="size-4 text-primary-700" aria-hidden="true" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              {createAction && (
                <CommandGroup forceMount className="shrink-0 border-t border-neutral-200">
                  <CommandItem
                    forceMount
                    onSelect={() => {
                      changeOpen(false);
                      requestAnimationFrame(createAction.onSelect);
                    }}
                    className="text-primary-700"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    {createAction.label}
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
