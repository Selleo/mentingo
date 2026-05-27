import { FormatRegistry } from "@sinclair/typebox";
import { validate as uuidValidate } from "uuid";

export function setupValidation() {
  FormatRegistry.Set("date", (value) => isValidDateString(value));
  FormatRegistry.Set("date-time", (value) => !Number.isNaN(Date.parse(value)));
  FormatRegistry.Set("uuid", (value) => uuidValidate(value));
}

function isValidDateString(value: string) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!dateMatch) return false;

  const [, year, month, day] = dateMatch;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  );
}
