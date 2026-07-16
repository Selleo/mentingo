import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

// import { ApiClient } from "~/api/api-client";
import { AUTOMATIONS_QUERY_KEY } from "~/api/queries/admin/useAutomations";

import type { GetAutomationByIdResponse } from "./automation.types";

const useAutomationByIdQuery = (automationId: string) => ({
  queryKey: [AUTOMATIONS_QUERY_KEY, { automationId }],
  queryFn: async (): Promise<GetAutomationByIdResponse> => {
    // TODO: Uncomment once backend is ready:
    // const { data } = await ApiClient.api.automationControllerGetById(automationId);
    // return data;

    // Stub: return empty automation so the app doesn't crash
    return {
      data: {
        id: automationId,
        name: "New Automation",
        description: "",
        status: "Draft" as const,
        nodes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  },
  select: (response: GetAutomationByIdResponse) => response.data,
  enabled: !!automationId && automationId !== "new",
});

/**
 * Fetches a single automation with its full flow tree.
 *
 * Backend contract (expected endpoint):
 *   GET /api/automations/:id
 *
 * Response shape: { data: AutomationDetail }
 *
 * The `nodes` array contains the tree structure flattened as adjacency list.
 * Each node has `parentId` (null for roots) and `children` (array of ids).
 */
export function useAutomationById(automationId: string) {
  return useQuery(useAutomationByIdQuery(automationId));
}

export function useAutomationByIdSuspense(automationId: string) {
  return useSuspenseQuery(useAutomationByIdQuery(automationId));
}
