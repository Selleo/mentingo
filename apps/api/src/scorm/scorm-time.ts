const SCORM_TIME_PATTERN = /^(\d{2,4}):([0-5]\d):([0-5]\d)(?:\.(\d{1,2}))?$/u;

export const SCORM_ZERO_TIME = "0000:00:00.00";

export const parseScorm12TimeToMs = (value?: string | null) => {
  if (!value) return 0;

  const match = value.match(SCORM_TIME_PATTERN);
  if (!match) return 0;

  const [, hours, minutes, seconds, fraction = "0"] = match;
  const hundredths = Number(fraction.padEnd(2, "0").slice(0, 2));

  return (
    Number(hours) * 3_600_000 + Number(minutes) * 60_000 + Number(seconds) * 1_000 + hundredths * 10
  );
};

export const formatMsAsScorm12Time = (valueMs: number) => {
  const safeValueMs = Math.max(0, Math.floor(valueMs));
  const hours = Math.floor(safeValueMs / 3_600_000);
  const minutes = Math.floor((safeValueMs % 3_600_000) / 60_000);
  const seconds = Math.floor((safeValueMs % 60_000) / 1_000);
  const hundredths = Math.floor((safeValueMs % 1_000) / 10);

  return `${String(hours).padStart(4, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
};

export const addScorm12Times = (left?: string | null, right?: string | null) =>
  formatMsAsScorm12Time(parseScorm12TimeToMs(left) + parseScorm12TimeToMs(right));
