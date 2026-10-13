import { useSuspenseQuery } from "@tanstack/react-query";

import { globalSettingsQueryOptions } from "./useGlobalSettings";

export function usePublicGlobalSettingsSuspense() {
  return useSuspenseQuery({
    ...globalSettingsQueryOptions,
    select: (response) => response?.data ?? null,
  });
}
