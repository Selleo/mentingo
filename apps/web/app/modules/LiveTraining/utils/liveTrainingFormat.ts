import { format } from "date-fns";

export const formatLiveTrainingDateRange = (startsAt: string, endsAt: string) => {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const isSameDay = start.toDateString() === end.toDateString();

  if (isSameDay) {
    return `${format(start, "d MMM yyyy, HH:mm")} - ${format(end, "HH:mm")}`;
  }

  return `${format(start, "d MMM yyyy, HH:mm")} - ${format(end, "d MMM yyyy, HH:mm")}`;
};

export const getPersonDisplayName = (person: { fullName: string | null }, fallback: string) =>
  person.fullName || fallback;
