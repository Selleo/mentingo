import { Check, ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCompetenciesConfiguration } from "~/api/queries/useCompetenciesConfiguration";
import { useCompetencyTracks } from "~/api/queries/useCompetencyTracks";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { useCompetenciesPickerSearch } from "../hooks/useCompetenciesPickerSearch";

import type { CompetencyPersonTrack } from "../competencies.types";

type CompetenciesTrackAssignmentProps = {
  personName: string;
  tracks: CompetencyPersonTrack[];
  disabled: boolean;
  onChange: (trackIds: string[]) => void;
};

export function CompetenciesTrackAssignment({
  personName,
  tracks,
  disabled,
  onChange,
}: CompetenciesTrackAssignmentProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLElement | null>(null);
  const { setSearch: setQuerySearch, query } = useCompetenciesPickerSearch();
  const maxTracks = useCompetenciesConfiguration().data?.maxTracksPerPerson;
  const searchedTracks = useCompetencyTracks(query).data?.data ?? [];
  const assignedIds = tracks.map((track) => track.id);
  const options = [
    ...tracks.filter((track) => !search || searchedTracks.some(({ id }) => id === track.id)),
    ...searchedTracks.filter((track) => !assignedIds.includes(track.id)),
  ];
  const limitReached = maxTracks !== undefined && tracks.length >= maxTracks;
  const [firstTrack, ...otherTracks] = tracks;
  const label = `${t("competencies.tracks")}: ${personName}`;

  const changeSearch = (next: string) => {
    setSearch(next);
    setQuerySearch(next);
  };
  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next && search) changeSearch("");
  };
  const toggle = (trackId: string) =>
    onChange(
      assignedIds.includes(trackId)
        ? assignedIds.filter((id) => id !== trackId)
        : [...assignedIds, trackId],
    );

  return (
    <Popover open={open} onOpenChange={changeOpen} modal>
      <PopoverTrigger asChild>
        <Button
          ref={(node) => {
            triggerRef.current = node;
          }}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          disabled={disabled}
          className="h-[42px] w-full justify-between gap-2 border-neutral-300 bg-white px-3 font-normal text-neutral-950 hover:border-primary-500 hover:text-neutral-950"
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className={cn("min-w-0 truncate text-left", !firstTrack && "text-neutral-600")}>
              {firstTrack?.name ?? t("competencies.noTrack")}
            </span>
            {otherTracks.length > 0 && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="body-sm shrink-0 cursor-help rounded-md bg-neutral-100 px-2 py-0.5 font-medium text-neutral-800">
                      +{otherTracks.length}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent variant="black">
                    <ul className="flex flex-col gap-0.5">
                      {otherTracks.map((track) => (
                        <li key={track.id}>{track.name}</li>
                      ))}
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </span>
          <ChevronDown className="size-4 shrink-0 text-neutral-700" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        onPointerDownOutside={(event) => {
          if (triggerRef.current?.contains(event.target as Node)) event.preventDefault();
        }}
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0"
      >
        <Command className="[&_[cmdk-input]]:outline-none" shouldFilter={false} label={label}>
          <CommandInput
            value={search}
            onValueChange={changeSearch}
            placeholder={t("competencies.select.search")}
            className="outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
          />
          <CommandList>
            <CommandEmpty>{t("competencies.select.noResults")}</CommandEmpty>
            <CommandGroup>
              {options.map((track) => {
                const assigned = assignedIds.includes(track.id);
                return (
                  <CommandItem
                    key={track.id}
                    value={track.id}
                    disabled={disabled || (limitReached && !assigned)}
                    onSelect={() => toggle(track.id)}
                  >
                    <span className="min-w-0 flex-1 truncate">{track.name}</span>
                    {assigned && <Check className="size-4 text-primary-700" aria-hidden="true" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {limitReached && (
            <p className="details border-t border-neutral-200 px-3 py-2 text-neutral-700">
              {t("competencies.trackLimitReached", { count: maxTracks })}
            </p>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
