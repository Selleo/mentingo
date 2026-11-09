const pad = (value: number) => String(value).padStart(2, "0");

/** The time limit is stored in minutes but edited as an "HH:MM" duration in a time input. */
export const minutesToTimeValue = (minutes: number | null | undefined): string =>
  minutes ? `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}` : "";

/** An empty or "00:00" value means no time limit. */
export const timeValueToMinutes = (value: string): number | null => {
  const [hours, minutes] = value.split(":").map(Number);
  const total = hours * 60 + minutes;

  return Number.isFinite(total) && total > 0 ? total : null;
};
