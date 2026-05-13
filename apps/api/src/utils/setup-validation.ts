import { FormatRegistry } from "@sinclair/typebox";
import { validate as uuidValidate } from "uuid";

export function setupValidation() {
  FormatRegistry.Set("date-time", (value) => !Number.isNaN(Date.parse(value)));
  FormatRegistry.Set("uuid", (value) => uuidValidate(value));
}
