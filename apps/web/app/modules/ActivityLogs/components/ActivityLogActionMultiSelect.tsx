import { Check, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

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
import { cn } from "~/lib/utils";
import {
  getSelectedActionLabel,
  type ActivityLogActionOption,
} from "~/modules/ActivityLogs/activityLogs.filters";

import type { ActivityLogActionType } from "@repo/shared";

type ActivityLogActionMultiSelectProps = {
  values: ActivityLogActionType[];
  options: ActivityLogActionOption[];
  placeholder: string;
  selectedCountLabel: string;
  searchPlaceholder: string;
  emptyLabel: string;
  allLabel: string;
  onChange: (values: ActivityLogActionType[]) => void;
};

export function ActivityLogActionMultiSelect({
  values,
  options,
  placeholder,
  selectedCountLabel,
  searchPlaceholder,
  emptyLabel,
  allLabel,
  onChange,
}: ActivityLogActionMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedValues = useMemo(() => new Set(values), [values]);
  const triggerLabel = getSelectedActionLabel(options, values, placeholder, selectedCountLabel);

  const handleToggle = (value: ActivityLogActionType) => {
    if (selectedValues.has(value)) {
      onChange(values.filter((selectedValue) => selectedValue !== value));
      return;
    }

    onChange([...values, value]);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full max-w-[320px] justify-between border-neutral-300 bg-white font-normal shadow-sm sm:w-[220px]",
            values.length ? "text-neutral-900" : "text-neutral-500",
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="ms-2 size-4 shrink-0 text-neutral-500" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,22rem)] p-0">
        <Command className="[&_[cmdk-input]]:outline-none">
          <CommandInput
            placeholder={searchPlaceholder}
            className="outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
          />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              <CommandItem value={allLabel} onSelect={() => onChange([])}>
                <span className="min-w-0 flex-1 truncate">{allLabel}</span>
                {values.length === 0 && (
                  <Check className="size-4 text-primary-700" aria-hidden="true" />
                )}
              </CommandItem>
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value);

                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    keywords={[option.value]}
                    onSelect={() => handleToggle(option.value)}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {isSelected && <Check className="size-4 text-primary-700" aria-hidden="true" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
