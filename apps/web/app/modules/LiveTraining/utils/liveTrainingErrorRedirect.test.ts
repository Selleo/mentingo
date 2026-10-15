import { AxiosError } from "axios";

import { getLiveTrainingErrorRedirect } from "./liveTrainingErrorRedirect";

import type { AxiosResponse } from "axios";

const httpError = (status: number) =>
  new AxiosError("request failed", undefined, undefined, undefined, { status } as AxiosResponse);

describe("live training query error redirects", () => {
  it("redirects forbidden training to the dashboard entry", () => {
    expect(getLiveTrainingErrorRedirect(httpError(403))).toBe("/");
  });

  it.each([400, 404])("redirects a %i training response to the calendar", (status) => {
    expect(getLiveTrainingErrorRedirect(httpError(status))).toBe("/calendar");
  });

  it("redirects non-HTTP errors to the calendar", () => {
    expect(getLiveTrainingErrorRedirect(new Error("invalid training"))).toBe("/calendar");
  });

  it.each([401, 429, 500, 503])(
    "propagates a %i response to the route error boundary",
    (status) => {
      expect(getLiveTrainingErrorRedirect(httpError(status))).toBeNull();
    },
  );

  it("propagates network errors to the route error boundary", () => {
    expect(getLiveTrainingErrorRedirect(new AxiosError("Network error"))).toBeNull();
  });
});
