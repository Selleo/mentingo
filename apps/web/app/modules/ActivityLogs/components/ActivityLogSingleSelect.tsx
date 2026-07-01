import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";

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
  getSelectedOptionLabel,
  type ActivityLogFilterOption,
} from "~/modules/ActivityLogs/activityLogs.filters";

type ActivityLogSingleSelectProps<TValue extends string> = {
  value?: TValue;
  options: ActivityLogFilterOption<TValue>[];
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  allLabel: string;
  onChange: (value: TValue | undefined) => void;
};

export function ActivityLogSingleSelect<TValue extends string>({
  value,
  options,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  allLabel,
  onChange,
}: ActivityLogSingleSelectProps<TValue>) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = getSelectedOptionLabel(options, value);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full max-w-[320px] justify-between border-neutral-300 bg-white font-normal shadow-sm sm:w-[190px]",
            selectedLabel ? "text-neutral-900" : "text-neutral-500",
          )}
        >
          <span className="truncate">{selectedLabel ?? placeholder}</span>
          <ChevronDown className="ms-2 size-4 shrink-0 text-neutral-500" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,20rem)] p-0">
        <Command className="[&_[cmdk-input]]:outline-none">
          <CommandInput
            placeholder={searchPlaceholder}
            className="outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
          />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={allLabel}
                onSelect={() => {
                  onChange(undefined);
                  setIsOpen(false);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{allLabel}</span>
                {!value && <Check className="size-4 text-primary-700" aria-hidden="true" />}
              </CommandItem>
              {options.map((option) => {
                const isSelected = option.value === value;

                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    keywords={[option.value]}
                    onSelect={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
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
