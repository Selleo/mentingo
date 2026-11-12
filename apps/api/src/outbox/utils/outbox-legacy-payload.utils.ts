import { LEGACY_FLAT_OUTBOX_PAYLOAD_FIELDS } from "../outbox.constants";

/**
 * The payload in its current shape when it was stored flat by an older API instance, or null when
 * it already has that shape. Cleared payloads stay empty.
 */
export const wrapLegacyFlatPayload = (
  eventType: string,
  payload: Record<string, unknown>,
): Record<string, unknown> | null => {
  const dataField = LEGACY_FLAT_OUTBOX_PAYLOAD_FIELDS[eventType];

  if (!dataField || dataField in payload || Object.keys(payload).length === 0) return null;

  return { [dataField]: payload };
};
