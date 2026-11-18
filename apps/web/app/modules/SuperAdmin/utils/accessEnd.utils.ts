import { endOfDay, format, parse } from "date-fns";

export const ACCESS_END_DATE_FORMAT = "yyyy-MM-dd";

/** The stored access end as the last day of access, in the browser's time zone. */
export function toAccessEndDate(isoTimestamp: string | null | undefined) {
  if (!isoTimestamp) return "";

  const date = new Date(isoTimestamp);

  if (Number.isNaN(date.getTime())) return "";

  return format(date, ACCESS_END_DATE_FORMAT);
}

/** Access lasts through the whole selected day (until 23:59:59.999); empty means unlimited access. */
export function toAccessEndsAt(accessEndDate: string | undefined) {
  if (!accessEndDate) return null;

  return endOfDay(parse(accessEndDate, ACCESS_END_DATE_FORMAT, new Date())).toISOString();
}

export function hasAccessEnded(accessEndsAt: string | null | undefined) {
  return Boolean(accessEndsAt && new Date(accessEndsAt).getTime() <= Date.now());
}
