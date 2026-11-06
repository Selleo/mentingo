/** Compact paginated attachment reads without hiding failures or active work. */
import { AUTHORING_TOOL_STATUS } from "./courseAuthoring.constants";

import type { AuthoringTurnPart } from "./courseAuthoring.types";

/** Keep one current successful/running source read per task in either timeline view. */
export const compactSourceReadActivity = <T>(
  entries: readonly T[],
  activity: (entry: T) => Pick<AuthoringTurnPart, "taskId" | "tool"> | undefined,
): T[] => {
  const selected = new Map<string, T>();
  const groupKey = (entry: T) => {
    const value = activity(entry);
    if (
      value?.tool?.toolName !== "read_selected_sources" ||
      value.tool.status === AUTHORING_TOOL_STATUS.FAILED ||
      value.tool.status === AUTHORING_TOOL_STATUS.STOPPED
    )
      return undefined;
    return value.taskId ?? "request";
  };
  for (const entry of entries) {
    const key = groupKey(entry);
    if (key === undefined) continue;
    const current = selected.get(key);
    const status = activity(entry)?.tool?.status;
    const currentStatus = current === undefined ? undefined : activity(current)?.tool?.status;
    if (
      current === undefined ||
      currentStatus !== AUTHORING_TOOL_STATUS.STARTED ||
      status === AUTHORING_TOOL_STATUS.STARTED
    )
      selected.set(key, entry);
  }
  return entries.filter((entry) => {
    const key = groupKey(entry);
    return key === undefined || selected.get(key) === entry;
  });
};
