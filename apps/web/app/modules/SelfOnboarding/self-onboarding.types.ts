import type { ApiClient } from "~/api/api-client";

export type HelpdeskSearchRequest = Parameters<typeof ApiClient.api.searchHelpdesk>[0];
export type HelpdeskSearchResponse = Awaited<
  ReturnType<typeof ApiClient.api.searchHelpdesk>
>["data"]["data"];
export type HelpdeskTutorial = Awaited<
  ReturnType<typeof ApiClient.api.getHelpdeskTutorial>
>["data"]["data"];
export type HelpdeskSearchHit = HelpdeskSearchResponse["results"][number];
export type HelpdeskSelection = { tutorial: HelpdeskTutorial; startMs: number };
