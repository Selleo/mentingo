import { Check, Loader2, UserPlus, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useUpdateLiveTraining } from "~/api/mutations/live-training/useUpdateLiveTraining";
import { useInfiniteUsers } from "~/api/queries/useUsers";
import { Badge } from "~/components/ui/badge";
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
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { useDebounce } from "~/hooks/useDebounce";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import {
  LIVE_TRAINING_PERSON_ROLES,
  type LiveTrainingDetails,
  type LiveTrainingPersonRole,
} from "~/modules/LiveTraining/liveTraining.types";
import {
  getLiveTrainingEditableTrainerIds,
  getLiveTrainingPeopleList,
  getUserCandidateDisplayName,
} from "~/modules/LiveTraining/utils/liveTrainingPeople";

type LiveTrainingPeopleSectionProps = {
  liveTraining: LiveTrainingDetails;
  canEditPeople: boolean;
};

type PersonRowProps = {
  name: string;
  profilePictureUrl: string | null;
  roles: LiveTrainingPersonRole[];
  canRemove: boolean;
  isRemoving: boolean;
  getRoleLabel: (role: LiveTrainingPersonRole) => string;
  removeLabel: string;
  onRemove: () => void;
};

function PersonRow({
  name,
  profilePictureUrl,
  roles,
  canRemove,
  isRemoving,
  getRoleLabel,
  removeLabel,
  onRemove,
}: PersonRowProps) {
  return (
    <div className="group/person-row flex min-w-0 items-center justify-between gap-3 rounded border border-neutral-200 px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar userName={name} profilePictureUrl={profilePictureUrl} className="size-9" />
        <p className="truncate text-sm font-medium text-neutral-950">{name}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <div className="flex flex-wrap justify-end gap-1.5">
          {roles.map((role) => (
            <Badge
              key={role}
              variant={role === LIVE_TRAINING_PERSON_ROLES.AUTHOR ? "success" : "default"}
              fontWeight="normal"
              className="rounded px-2 py-0.5 text-xs"
            >
              {getRoleLabel(role)}
            </Badge>
          ))}
        </div>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="size-7 opacity-100 sm:opacity-0 sm:group-hover/person-row:opacity-100"
            disabled={isRemoving}
            aria-label={removeLabel}
            onClick={onRemove}
          >
            {isRemoving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <X className="size-3.5" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export function LiveTrainingPeopleSection({
  liveTraining,
  canEditPeople,
}: LiveTrainingPeopleSectionProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const { mutateAsync: updateLiveTraining, isPending: isUpdating } = useUpdateLiveTraining();
  const people = getLiveTrainingPeopleList(liveTraining, t("liveTrainingView.sidebar.unknownUser"));
  const editableTrainerIds = useMemo(
    () => getLiveTrainingEditableTrainerIds(liveTraining),
    [liveTraining],
  );
  const trainerIds = useMemo(
    () => new Set(liveTraining.trainers.map((trainer) => trainer.id)),
    [liveTraining.trainers],
  );
  const {
    data: userPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteUsers(
    {
      keyword: debouncedSearch,
      archived: false,
      perPage: 20,
      sort: "firstName",
    },
    { enabled: isPopoverOpen && canEditPeople },
  );
  const users = useMemo(
    () => userPages?.pages.flatMap((page) => page.data) ?? [],
    [userPages?.pages],
  );
  const getRoleLabel = (role: LiveTrainingPersonRole) => {
    if (role === LIVE_TRAINING_PERSON_ROLES.AUTHOR) return t("liveTrainingView.sidebar.author");

    return t("liveTrainingView.sidebar.trainer");
  };

  const updateTrainers = async (nextTrainerIds: string[]) => {
    await updateLiveTraining({
      id: liveTraining.id,
      data: {
        language,
        trainerUserIds: nextTrainerIds,
      },
    });
  };

  const handleAddTrainer = async (userId: string) => {
    if (trainerIds.has(userId) || userId === liveTraining.author.id) return;

    await updateTrainers([...editableTrainerIds, userId]);
  };

  const handleRemoveTrainer = async (userId: string) => {
    await updateTrainers(editableTrainerIds.filter((trainerId) => trainerId !== userId));
  };

  const emptyLabel = isLoading
    ? t("liveTrainingView.sidebar.loadingUsers")
    : t("liveTrainingView.sidebar.noUserResults");

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <section className="group/people flex max-h-[28rem] min-h-0 flex-col rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-neutral-500" />
            <h2 className="text-sm font-semibold text-neutral-950">
              {t("liveTrainingView.sidebar.people")}
            </h2>
            <Badge variant="outline" fontWeight="normal" className="rounded px-2 py-0.5 text-xs">
              {people.length}
            </Badge>
          </div>
        </div>
        <div className="min-h-0 overflow-y-auto pr-1">
          <div className="grid gap-3">
            {people.length > 0 ? (
              people.map((person) => (
                <PersonRow
                  key={person.id}
                  name={person.name}
                  profilePictureUrl={person.profilePictureUrl}
                  roles={person.roles}
                  canRemove={
                    canEditPeople &&
                    person.roles.includes(LIVE_TRAINING_PERSON_ROLES.TRAINER) &&
                    !person.roles.includes(LIVE_TRAINING_PERSON_ROLES.AUTHOR)
                  }
                  isRemoving={isUpdating}
                  getRoleLabel={getRoleLabel}
                  removeLabel={t("liveTrainingView.sidebar.removeTrainer", { name: person.name })}
                  onRemove={() => handleRemoveTrainer(person.id)}
                />
              ))
            ) : (
              <p className="text-sm text-neutral-500">{t("liveTrainingView.sidebar.noTrainers")}</p>
            )}
          </div>
        </div>
        {canEditPeople && (
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "mt-3 flex shrink-0 items-center justify-center gap-2 rounded border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-500 transition",
                "hover:border-primary-500 hover:bg-primary-50 hover:text-primary-700",
                "focus-visible:border-primary-500 focus-visible:bg-primary-50 focus-visible:text-primary-700 focus-visible:outline-none",
              )}
            >
              <UserPlus className="size-4" />
              {t("liveTrainingView.sidebar.addTrainerHint")}
            </button>
          </PopoverTrigger>
        )}
      </section>
      {canEditPeople && (
        <PopoverContent
          side="bottom"
          align="center"
          sideOffset={10}
          className="w-[min(92vw,24rem)] p-0"
        >
          <Command shouldFilter={false} className="[&_[cmdk-input]]:outline-none">
            <CommandInput
              value={search}
              className="outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
              placeholder={t("liveTrainingView.sidebar.searchPeople")}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>{emptyLabel}</CommandEmpty>
              <CommandGroup>
                {users.map((user) => {
                  const name = getUserCandidateDisplayName(user);
                  const isAuthor = user.id === liveTraining.author.id;
                  const isTrainer = trainerIds.has(user.id);
                  const isSelected = isAuthor || isTrainer;

                  return (
                    <CommandItem
                      key={user.id}
                      value={user.id}
                      disabled={isSelected || isUpdating}
                      onSelect={() => handleAddTrainer(user.id)}
                    >
                      <UserAvatar
                        userName={name}
                        profilePictureUrl={user.profilePictureUrl}
                        className="size-8"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-950">{name}</p>
                        <p className="truncate text-xs text-neutral-500">{user.email}</p>
                      </div>
                      {isSelected && <Check className="size-4 text-primary-700" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {hasNextPage && (
                <div className="border-t border-neutral-100 p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full gap-2"
                    disabled={isFetchingNextPage}
                    onClick={() => fetchNextPage()}
                  >
                    {isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
                    {t("liveTrainingView.sidebar.loadMoreUsers")}
                  </Button>
                </div>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      )}
    </Popover>
  );
}
