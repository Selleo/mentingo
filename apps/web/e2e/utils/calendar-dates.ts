const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const getTomorrowDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);

  return toLocalDateString(date);
};

export const getCalendarRangeAround = (dateIso: string) => {
  const start = new Date(dateIso);
  const end = new Date(dateIso);

  start.setDate(start.getDate() - 1);
  end.setDate(end.getDate() + 1);

  return { start: start.toISOString(), end: end.toISOString() };
};
