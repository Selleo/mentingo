import { format } from "date-fns";

import type { GetLiveTrainingsResponse } from "~/api/generated-api";

type ScheduledLiveTraining = GetLiveTrainingsResponse["data"][number];

export const formatScheduledLiveTrainingDateRange = (liveTraining: ScheduledLiveTraining) => {
  const startsAt = new Date(liveTraining.startsAt);
  const endsAt = new Date(liveTraining.endsAt);

  if (liveTraining.allDay) {
    return format(startsAt, "d MMM yyyy");
  }

  if (startsAt.toDateString() === endsAt.toDateString()) {
    return `${format(startsAt, "d MMM yyyy, HH:mm")} - ${format(endsAt, "HH:mm")}`;
  }

  return `${format(startsAt, "d MMM yyyy, HH:mm")} - ${format(endsAt, "d MMM yyyy, HH:mm")}`;
};
