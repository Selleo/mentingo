import { useQuery } from "@tanstack/react-query";

// import { ApiClient } from "~/api/api-client";

import type { GetAllAutomationsResponse } from "./automation.types";

export const AUTOMATIONS_QUERY_KEY = "automations";

export type AutomationsSearchParams = {
  search?: string;
  status?: string;
  page?: number;
  perPage?: number;
};

const useAutomationsQuery = (params?: AutomationsSearchParams) => ({
  queryKey: [AUTOMATIONS_QUERY_KEY, params],
  queryFn: async (): Promise<GetAllAutomationsResponse> => {
    // TODO: Uncomment once backend is ready:
    // const { data } = await ApiClient.api.automationControllerGetAll(params);
    // return data;

    // Stub: return empty list so the app doesn't crash
    return { data: [], pagination: { total: 0, page: 1, perPage: 20 } };
  },
  select: (response: GetAllAutomationsResponse) => response.data,
});

/**
 * Fetches the list of automations for the admin panel.
 *
 * Backend contract (expected endpoint):
 *   GET /api/automations?search=&status=&page=&perPage=
 *
 * Response shape: { data: AutomationListItem[], pagination: { total, page, perPage } }
 */
export function useAutomations(params?: AutomationsSearchParams) {
  return useQuery(useAutomationsQuery(params));
}
