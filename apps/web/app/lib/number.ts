export const parseFiniteNumberOrNull = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return null;

  const parsedValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : null;
};
