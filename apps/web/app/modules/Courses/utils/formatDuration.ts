export const formatDuration = (seconds?: number): string => {
  if (!seconds) return "0 min";

  const minutes = Math.ceil(seconds / 60);

  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
};
