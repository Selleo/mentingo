import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { QueryClient } from "@tanstack/react-query";
import { AxiosHeaders } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "~/api/api-client";
import { helpdeskTutorialFixture } from "~/modules/SelfOnboarding/__tests__/fixtures";

import { helpdeskSearchQueryOptions } from "./useSelfOnboardingSearch";
import { helpdeskTutorialQueryOptions } from "./useSelfOnboardingTutorial";

import type { QueryFunctionContext } from "@tanstack/react-query";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generated Helpdesk requests", () => {
  it("forwards exact public arguments and cancellation to the generated client", async () => {
    const signal = new AbortController().signal;
    const response = { mode: "hybrid" as const, results: [] };
    const search = vi.spyOn(ApiClient.api, "searchHelpdesk").mockResolvedValue({
      data: { data: response },
      status: 200,
      statusText: "OK",
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
    const tutorial = vi.spyOn(ApiClient.api, "getHelpdeskTutorial").mockResolvedValue({
      data: { data: helpdeskTutorialFixture },
      status: 200,
      statusText: "OK",
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
    const input = {
      query: "publish",
      language: SUPPORTED_LANGUAGES.EN,
      pageKey: "admin.course.curriculum",
    };
    const context = { signal } as QueryFunctionContext;
    expect(await helpdeskSearchQueryOptions(input).queryFn(context)).toEqual(response);
    expect(search).toHaveBeenCalledWith(input, { signal });
    expect(
      await helpdeskTutorialQueryOptions(
        helpdeskTutorialFixture.key,
        SUPPORTED_LANGUAGES.EN,
      ).queryFn(context),
    ).toEqual(helpdeskTutorialFixture);
    expect(tutorial).toHaveBeenCalledWith(
      helpdeskTutorialFixture.key,
      { language: SUPPORTED_LANGUAGES.EN },
      { signal },
    );
  });
  it("cancels an in-flight generated request when its query is cancelled", async () => {
    let observedSignal: AbortSignal | undefined;
    vi.spyOn(ApiClient.api, "searchHelpdesk").mockImplementation((_input, options) => {
      const signal = options?.signal as AbortSignal | undefined;
      if (!signal) throw new Error("Expected an abort signal");
      observedSignal = signal;
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const options = helpdeskSearchQueryOptions({
      query: "publish",
      language: SUPPORTED_LANGUAGES.EN,
    });
    const request = client.fetchQuery(options).catch((error: unknown) => error);
    await client.cancelQueries({ queryKey: options.queryKey });
    await request;
    expect(observedSignal?.aborted).toBe(true);
    client.clear();
  });
});
