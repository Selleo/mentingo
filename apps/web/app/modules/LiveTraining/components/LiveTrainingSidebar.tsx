import { LIVE_TRAINING_DELIVERY_TYPES } from "@repo/shared";
import { Info, MapPin, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { cn } from "~/lib/utils";
import { LIVE_TRAINING_PERSON_ROLES } from "~/modules/LiveTraining/liveTraining.types";
import { getPersonDisplayName } from "~/modules/LiveTraining/utils/liveTrainingFormat";

import type {
  LiveTrainingDetails,
  LiveTrainingPersonListItem,
  LiveTrainingPersonRole,
} from "~/modules/LiveTraining/liveTraining.types";

type LiveTrainingSidebarProps = {
  liveTraining: LiveTrainingDetails;
  className?: string;
};

type PersonRowProps = {
  name: string;
  profilePictureUrl: string | null;
  roles: LiveTrainingPersonRole[];
  getRoleLabel: (role: LiveTrainingPersonRole) => string;
};

function getPeopleList(liveTraining: LiveTrainingDetails, fallbackName: string) {
  const peopleById = new Map<string, LiveTrainingPersonListItem>();
  const authorName = getPersonDisplayName(liveTraining.author, fallbackName);

  peopleById.set(liveTraining.author.id, {
    id: liveTraining.author.id,
    name: authorName,
    profilePictureUrl: liveTraining.author.profilePictureUrl,
    roles: [LIVE_TRAINING_PERSON_ROLES.AUTHOR],
  });

  for (const trainer of liveTraining.trainers) {
    const existingPerson = peopleById.get(trainer.id);

    if (existingPerson) {
      if (!existingPerson.roles.includes(LIVE_TRAINING_PERSON_ROLES.TRAINER)) {
        existingPerson.roles.push(LIVE_TRAINING_PERSON_ROLES.TRAINER);
      }

      continue;
    }

    peopleById.set(trainer.id, {
      id: trainer.id,
      name: getPersonDisplayName(trainer, fallbackName),
      profilePictureUrl: trainer.profilePictureUrl,
      roles: [LIVE_TRAINING_PERSON_ROLES.TRAINER],
    });
  }

  return [...peopleById.values()];
}

function PersonRow({ name, profilePictureUrl, roles, getRoleLabel }: PersonRowProps) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded border border-neutral-200 px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar userName={name} profilePictureUrl={profilePictureUrl} className="size-9" />
        <p className="truncate text-sm font-medium text-neutral-950">{name}</p>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
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
    </div>
  );
}

export function LiveTrainingSidebar({ liveTraining, className }: LiveTrainingSidebarProps) {
  const { t } = useTranslation();
  const isOffline = liveTraining.deliveryType === LIVE_TRAINING_DELIVERY_TYPES.OFFLINE;
  const people = getPeopleList(liveTraining, t("liveTrainingView.sidebar.unknownUser"));
  const getRoleLabel = (role: LiveTrainingPersonRole) => {
    if (role === LIVE_TRAINING_PERSON_ROLES.AUTHOR) return t("liveTrainingView.sidebar.author");

    return t("liveTrainingView.sidebar.trainer");
  };

  return (
    <aside className={cn("grid gap-4", className)}>
      <section className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Info className="size-4 text-neutral-500" />
          <h2 className="text-sm font-semibold text-neutral-950">
            {t("liveTrainingView.sidebar.details")}
          </h2>
        </div>
        <dl className="grid gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">{t("liveTrainingView.sidebar.status")}</dt>
            <dd className="text-right text-neutral-900">
              {t(`liveTrainingView.status.${liveTraining.status}`)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">{t("liveTrainingView.sidebar.maxParticipants")}</dt>
            <dd className="text-right text-neutral-900">{liveTraining.maxParticipants}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">{t("liveTrainingView.sidebar.visibility")}</dt>
            <dd className="text-right text-neutral-900">
              {t(`liveTrainingView.visibility.${liveTraining.visibilityScope}`)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">{t("liveTrainingView.sidebar.courses")}</dt>
            <dd className="text-right text-neutral-900">{liveTraining.linkedCourses.length}</dd>
          </div>
          {isOffline && liveTraining.location && (
            <div className="flex justify-between gap-4">
              <dt className="inline-flex items-center gap-1.5 text-neutral-500">
                <MapPin className="size-3.5" />
                {t("liveTrainingView.sidebar.location")}
              </dt>
              <dd className="text-right text-neutral-900">{liveTraining.location}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Users className="size-4 text-neutral-500" />
          <h2 className="text-sm font-semibold text-neutral-950">
            {t("liveTrainingView.sidebar.people")}
          </h2>
        </div>
        <div className="grid gap-3">
          {people.length > 0 ? (
            people.map((person) => (
              <PersonRow
                key={person.id}
                name={person.name}
                profilePictureUrl={person.profilePictureUrl}
                roles={person.roles}
                getRoleLabel={getRoleLabel}
              />
            ))
          ) : (
            <p className="text-sm text-neutral-500">{t("liveTrainingView.sidebar.noTrainers")}</p>
          )}
        </div>
      </section>

    </aside>
  );
}
