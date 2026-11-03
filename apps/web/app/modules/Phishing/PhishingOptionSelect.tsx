import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useInfinitePhishingOptions } from "~/api/queries/useInfinitePhishingOptions";
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
import { useDebounce } from "~/hooks/useDebounce";
import { cn } from "~/lib/utils";

import type { Option } from "~/components/ui/multiselect";

type Props = {
  id: string;
  label: string;
  value: Option[];
  onChange: (options: Option[]) => void;
  multiple?: boolean;
  describedBy?: string;
} & (
  | { kind: Parameters<typeof useInfinitePhishingOptions>[0]; options?: never }
  | { kind?: never; options: Option[] }
);

export function PhishingOptionSelect({
  id,
  label,
  kind,
  value,
  onChange,
  multiple = false,
  options: staticOptions,
  describedBy,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const {
    data,
    isLoading,
    isError: queryError,
    refetch,
    hasNextPage: hasMoreResults,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfinitePhishingOptions(kind ?? "users", debouncedSearch, open && !!kind);
  const isError = !!kind && queryError;
  const hasNextPage = !!kind && hasMoreResults;
  const options =
    staticOptions?.filter((option) =>
      option.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
    ) ??
    data?.pages.flatMap((page) =>
      page.items.map((item) => ({ value: item.id, label: item.label })),
    ) ??
    [];
  const searching = !!kind && (isLoading || search !== debouncedSearch);

  function selectOption(option: Option) {
    if (!multiple) {
      onChange([option]);
      setOpen(false);
      return;
    }
    const selected = value.some((item) => item.value === option.value);
    onChange(selected ? value.filter((item) => item.value !== option.value) : [...value, option]);
  }

  return (
    <div className="relative min-w-0">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-label={label}
            aria-expanded={open}
            aria-describedby={describedBy}
            className="w-full justify-between font-normal"
          >
            <span
              className={cn("truncate", {
                "text-neutral-500": !value.length,
                "mr-7": value.length > 0,
              })}
            >
              {value.map((item) => item.label).join(", ") || t("phishing.choose")}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder={t("globalSearch.search")}
              aria-label={label}
              maxLength={200}
            />
            <CommandList
              onScroll={(event) => {
                const list = event.currentTarget;
                if (
                  list.scrollHeight - list.scrollTop - list.clientHeight < 40 &&
                  hasNextPage &&
                  !isFetchingNextPage &&
                  !searching &&
                  !isError
                ) {
                  void fetchNextPage();
                }
              }}
            >
              {searching && (
                <div role="status" className="p-4 text-sm">
                  {t("phishing.loading")}
                </div>
              )}
              {isError && (
                <div role="alert" className="p-3 text-sm">
                  <p>{t("phishing.serviceError")}</p>
                  <Button type="button" variant="ghost" onClick={() => void refetch()}>
                    {t("phishing.retry")}
                  </Button>
                </div>
              )}
              {!searching && !isError && <CommandEmpty>{t("phishing.noOptions")}</CommandEmpty>}
              {!searching && (
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => selectOption(option)}
                    >
                      <span className="flex-1">{option.label}</span>
                      {value.some((item) => item.value === option.value) && (
                        <Check className="ml-2 size-4 shrink-0" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {hasNextPage && !searching && !isError && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={isFetchingNextPage}
                  onClick={() => void fetchNextPage()}
                >
                  {isFetchingNextPage && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {t("superAdminTenantsView.supportModePopover.loadMore")}
                </Button>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <button
          type="button"
          className="absolute right-9 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded text-neutral-500 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={t("phishing.removeSelection", { label })}
          title={t("phishing.removeSelection", { label })}
          onClick={() => {
            onChange([]);
            setSearch("");
            document.getElementById(id)?.focus();
          }}
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
