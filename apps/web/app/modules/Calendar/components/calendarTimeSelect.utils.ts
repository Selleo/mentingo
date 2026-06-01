export const DEFAULT_TIME_STEP_MINUTES = 15;

const padTimePart = (value: number) => String(value).padStart(2, "0");

export const buildTimeOptions = (stepMinutes: number) => {
  const options: string[] = [];

  for (
    let minutesFromMidnight = 0;
    minutesFromMidnight < 24 * 60;
    minutesFromMidnight += stepMinutes
  ) {
    const hours = Math.floor(minutesFromMidnight / 60);
    const minutes = minutesFromMidnight % 60;
    options.push(`${padTimePart(hours)}:${padTimePart(minutes)}`);
  }

  return options;
};
