import { DIRECTORY_SYNC_SYNCABLE_CONNECTION_STATUSES } from "../directory-sync.constants";

import type { DirectorySyncConnection } from "../repositories/directory-sync-connection.repository";

/** A connection syncs only after a successful verification has stored the directory customer. */
export function isConnectionSyncable(
  connection: Pick<DirectorySyncConnection, "status" | "directoryCustomerId">,
) {
  return (
    Boolean(connection.directoryCustomerId) &&
    DIRECTORY_SYNC_SYNCABLE_CONNECTION_STATUSES.includes(connection.status)
  );
}
