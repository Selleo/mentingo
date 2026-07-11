export const formatDuration = (seconds?: number): string => {
  if (!seconds) return "0 min";

  const minutes = Math.ceil(seconds / 60);

  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
};

export const formatDurationToHalfHour = (seconds?: number): string => {
  if (!seconds) return "0 min";

  const roundedMinutes = Math.ceil(seconds / 60 / 30) * 30;
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  if (!hours) return `${minutes} min`;

  return minutes ? `${hours}h ${minutes}min` : `${hours}h`;
};
