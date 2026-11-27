import {
  DIRECTORY_SYNC_CONNECTION_STATUSES,
  DIRECTORY_SYNC_RUN_STATUSES,
  type DirectorySyncConnectionStatus,
  type DirectorySyncRunStatus,
} from "@repo/shared";
import { match } from "ts-pattern";

import type { DirectorySyncRun } from "./directorySync.types";
import type { ComponentProps } from "react";
import type { Badge } from "~/components/ui/badge";

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

export function getConnectionStatusBadgeVariant(
  status: DirectorySyncConnectionStatus,
): BadgeVariant {
  return match(status)
    .with(DIRECTORY_SYNC_CONNECTION_STATUSES.ACTIVE, () => "success" as const)
    .with(DIRECTORY_SYNC_CONNECTION_STATUSES.FAILING, () => "failedFilled" as const)
    .with(DIRECTORY_SYNC_CONNECTION_STATUSES.PENDING_VERIFICATION, () => "inProgress" as const)
    .exhaustive();
}

export function getRunStatusBadgeVariant(status: DirectorySyncRunStatus): BadgeVariant {
  return match(status)
    .with(DIRECTORY_SYNC_RUN_STATUSES.SUCCEEDED, () => "success" as const)
    .with(
      DIRECTORY_SYNC_RUN_STATUSES.FAILED,
      DIRECTORY_SYNC_RUN_STATUSES.ABORTED_BY_SAFEGUARD,
      () => "failedFilled" as const,
    )
    .with(
      DIRECTORY_SYNC_RUN_STATUSES.QUEUED,
      DIRECTORY_SYNC_RUN_STATUSES.RUNNING,
      () => "inProgress" as const,
    )
    .exhaustive();
}

export function getRunChangeCounts(run: DirectorySyncRun) {
  return [
    { key: "created", count: run.createdUsersCount },
    { key: "linked", count: run.linkedUsersCount },
    { key: "roleChanged", count: run.roleChangedUsersCount },
    { key: "archived", count: run.archivedUsersCount },
    { key: "restored", count: run.restoredUsersCount },
    { key: "groupMembershipChanged", count: run.groupMembershipChangedUsersCount },
    { key: "skipped", count: run.skippedUsersCount },
  ] as const;
}
