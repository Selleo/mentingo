import { useQuery } from "@tanstack/react-query";

import { userSettingsQueryOptions } from "./useUserSettings";

import type { GetUserSettingsResponse } from "../generated-api";
import type { AdminSettings } from "~/modules/Dashboard/Settings/types";

export function useAdminSettings() {
  return useQuery({
    ...userSettingsQueryOptions,
    select: (data: GetUserSettingsResponse | null) => {
      return data?.data?.settings as AdminSettings;
    },
  });
}
