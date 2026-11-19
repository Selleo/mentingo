import type { Page, Request } from "@playwright/test";

const matchesApiCall = (method: string, url: string, expectedMethod: string, path: string) =>
  method === expectedMethod && new URL(url).pathname === path;

/** Resolves with the first successful response to `method path`, so a negative assertion that follows runs on loaded data. */
export const waitForApiResponse = (page: Page, method: string, path: string) =>
  page.waitForResponse(
    (response) =>
      response.ok() && matchesApiCall(response.request().method(), response.url(), method, path),
  );

/** Collects the `method path` requests the page sends from now on, to assert that an action sent none. */
export const recordApiRequests = (page: Page, method: string, path: string) => {
  const requests: Request[] = [];

  page.on("request", (request) => {
    if (matchesApiCall(request.method(), request.url(), method, path)) requests.push(request);
  });

  return requests;
};
