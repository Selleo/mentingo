import { match, P } from "ts-pattern";

import { OUTBOX_MAX_ERROR_LENGTH } from "../outbox.constants";

/** Turns whatever a delivery threw into the text stored as the event's last error. */
export const toOutboxErrorMessage = (error: unknown): string =>
  match(error)
    .with(P.string, (message) => message)
    .with(P.instanceOf(Error), ({ message }) => message)
    .otherwise(stringifyThrownValue)
    .slice(0, OUTBOX_MAX_ERROR_LENGTH);

const stringifyThrownValue = (thrownValue: unknown): string => {
  try {
    return JSON.stringify(thrownValue) ?? String(thrownValue);
  } catch {
    return String(thrownValue);
  }
};
