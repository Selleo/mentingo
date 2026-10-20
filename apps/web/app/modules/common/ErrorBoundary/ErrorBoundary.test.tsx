import { CanceledError } from "axios";

import { APP_ERROR_KINDS, getAppErrorKind } from "./ErrorBoundary";

const createAxiosError = (status?: number) => ({
  isAxiosError: true,
  response: status ? { status } : undefined,
});

const createRouteErrorResponse = (status: number) => ({
  status,
  statusText: "error",
  internal: false,
  data: null,
});

describe("getAppErrorKind", () => {
  it.each([
    {
      name: "a 401 API response",
      error: createAxiosError(401),
      kind: APP_ERROR_KINDS.SESSION_EXPIRED,
    },
    { name: "a 403 API response", error: createAxiosError(403), kind: APP_ERROR_KINDS.FORBIDDEN },
    { name: "a 404 API response", error: createAxiosError(404), kind: APP_ERROR_KINDS.NOT_FOUND },
    {
      name: "a 404 route response",
      error: createRouteErrorResponse(404),
      kind: APP_ERROR_KINDS.NOT_FOUND,
    },
    {
      name: "an API request without a response",
      error: createAxiosError(),
      kind: APP_ERROR_KINDS.CONNECTION,
    },
    {
      name: "a canceled API request",
      error: new CanceledError(),
      kind: APP_ERROR_KINDS.CONNECTION,
    },
    { name: "a 500 API response", error: createAxiosError(500), kind: APP_ERROR_KINDS.UNKNOWN },
    { name: "a runtime error", error: new Error("boom"), kind: APP_ERROR_KINDS.UNKNOWN },
  ])("maps $name to $kind", ({ error, kind }) => {
    expect(getAppErrorKind(error)).toBe(kind);
  });
});
