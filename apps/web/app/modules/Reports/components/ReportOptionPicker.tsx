import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { useDebounce } from "~/hooks/useDebounce";
import { cn } from "~/lib/utils";

type ReportOption = { id: string; label: string };

type ReportOptionPickerProps = {
  label: string;
  placeholder: string;
  options: ReportOption[] | undefined;
  selectedIds: string[];
  selectedLabel?: string;
  multiple?: boolean;
  className?: string;
  onSearchChange?: (search: string) => void;
  onToggle: (option: ReportOption) => void;
};

export function ReportOptionPicker({
  label,
  placeholder,
  options = [],
  selectedIds,
  selectedLabel,
  multiple = false,
  className,
  onSearchChange,
  onToggle,
}: ReportOptionPickerProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const listId = useId();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);

  useEffect(() => {
    onSearchChange?.(debouncedSearch);
  }, [debouncedSearch, onSearchChange]);

  const triggerText = selectedLabel ?? options.find(({ id }) => id === selectedIds[0])?.label;

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-label={label}
          aria-expanded={isOpen}
          aria-controls={listId}
          className={cn(
            "flex h-10 min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-left text-sm text-neutral-900 transition-colors hover:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
            className,
          )}
        >
          <span className={cn("truncate", !triggerText && "text-muted-foreground")}>
            {triggerText || placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] min-w-64 p-0">
        <Command shouldFilter={!onSearchChange}>
          <CommandInput
            placeholder={t("reports.picker.search")}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList id={listId} className="max-h-64 p-1">
            <CommandEmpty>{t("reports.picker.empty")}</CommandEmpty>
            {options.map((option) => {
              const isSelected = selectedIds.includes(option.id);
              return (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  keywords={[option.label]}
                  onSelect={() => {
                    onToggle(option);
                    if (!multiple) setIsOpen(false);
                  }}
                >
                  <Check className={cn("size-4 text-primary-700", !isSelected && "invisible")} />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
