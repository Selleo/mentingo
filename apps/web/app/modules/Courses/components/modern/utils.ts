export const formatDuration = (minutes?: number) => {
  if (!minutes || minutes <= 0) return undefined;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0 && remainingMinutes > 0) {
    return `${hours}h ${remainingMinutes}min`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${remainingMinutes}min`;
};

export const getProgressPercent = (completed?: number, total?: number) => {
  if (!completed || !total || total <= 0) return undefined;

  return Math.min(100, Math.round((completed / total) * 100));
};
