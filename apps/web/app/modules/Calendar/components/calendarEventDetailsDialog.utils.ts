import { format } from "date-fns";

export const formatEventDateRange = (startsAt: string, endsAt: string, allDay: boolean) => {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (allDay) {
    const inclusiveEnd = new Date(end);
    inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);

    if (start.toDateString() === inclusiveEnd.toDateString()) {
      return format(start, "d MMM yyyy");
    }

    return `${format(start, "d MMM yyyy")} - ${format(inclusiveEnd, "d MMM yyyy")}`;
  }

  if (start.toDateString() === end.toDateString()) {
    return `${format(start, "d MMM yyyy, HH:mm")} - ${format(end, "HH:mm")}`;
  }

  return `${format(start, "d MMM yyyy, HH:mm")} - ${format(end, "d MMM yyyy, HH:mm")}`;
};
