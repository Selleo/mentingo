import { useEffect, useRef } from "react";

import { isDirectorySyncRunUnfinished } from "~/api/queries/admin/useDirectorySyncConnection";
import { DIRECTORY_SYNC_RUNS_QUERY_KEY } from "~/api/queries/admin/useDirectorySyncRuns";
import { GROUPS_QUERY_KEY } from "~/api/queries/admin/useGroups";
import { queryClient } from "~/api/queryClient";

import type { DirectorySyncRun } from "./directorySync.types";

/** Refetches users and groups once a run the admin was watching finishes. */
export function useRefreshDirectoryDataAfterSync(latestRun: DirectorySyncRun | null) {
  const previousRunRef = useRef(latestRun);

  useEffect(() => {
    const previousRun = previousRunRef.current;
    previousRunRef.current = latestRun;

    if (!previousRun || !latestRun || isDirectorySyncRunUnfinished(latestRun.status)) return;

    const hasRunFinished =
      previousRun.id !== latestRun.id || isDirectorySyncRunUnfinished(previousRun.status);

    if (!hasRunFinished) return;

    queryClient.invalidateQueries({ queryKey: ["users"] });
    queryClient.invalidateQueries({ queryKey: [GROUPS_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: [DIRECTORY_SYNC_RUNS_QUERY_KEY] });
  }, [latestRun]);
}
