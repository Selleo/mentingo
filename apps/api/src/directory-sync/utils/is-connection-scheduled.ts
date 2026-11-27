import { isConnectionSyncable } from "./is-connection-syncable";

import type { DirectorySyncConnection } from "../repositories/directory-sync-connection.repository";

/**
 * The schedule only takes over after the first successful sync, which an admin always starts
 * by hand once the connection is fully configured.
 */
export function isConnectionScheduled(
  connection: Pick<
    DirectorySyncConnection,
    "status" | "directoryCustomerId" | "lastSuccessfulSyncAt"
  >,
) {
  return isConnectionSyncable(connection) && Boolean(connection.lastSuccessfulSyncAt);
}
