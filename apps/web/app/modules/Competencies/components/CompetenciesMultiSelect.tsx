import { Check, ChevronDown, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

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

type CompetenciesMultiSelectOption = { value: string; label: string; disabled?: boolean };

export function CompetenciesMultiSelect({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: CompetenciesMultiSelectOption[];
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const listId = useId();
  const selected = value
    .map((id) => options.find((option) => option.value === id))
    .filter((option): option is CompetenciesMultiSelectOption => Boolean(option));
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <div
          ref={(node) => {
            triggerRef.current = node;
          }}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={label}
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(event) => {
            if (!disabled && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              setOpen(true);
            }
          }}
          className={cn(
            "flex min-h-[42px] w-full cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm transition-colors hover:border-primary-500",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {selected.map((option) => (
              <span
                key={option.value}
                className="inline-flex items-center gap-1 rounded-md bg-primary-100 py-0.5 pl-2 pr-1 text-primary-800"
              >
                {option.label}
                <button
                  type="button"
                  aria-label={`${t("competencies.remove")}: ${option.label}`}
                  className="rounded p-0.5 hover:bg-primary-200"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggle(option.value);
                  }}
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </span>
            ))}
            {!selected.length && <span className="px-1 text-neutral-600">{label}</span>}
          </span>
          <ChevronDown className="size-4 shrink-0 text-neutral-700" aria-hidden="true" />
        </div>
      </PopoverTrigger>
      <PopoverContent
        onPointerDownOutside={(event) => {
          if (triggerRef.current?.contains(event.target as Node)) event.preventDefault();
        }}
        id={listId}
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0"
      >
        <Command className="[&_[cmdk-input]]:outline-none">
          <CommandInput
            placeholder={t("competencies.select.search")}
            className="outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
          />
          <CommandList>
            <CommandEmpty>{t("competencies.select.noResults")}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.value}`}
                  disabled={option.disabled}
                  onSelect={() => toggle(option.value)}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {value.includes(option.value) && (
                    <Check className="size-4 text-primary-700" aria-hidden="true" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
