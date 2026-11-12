import { QueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "~/api/api-client";

import { secretQueryOptions } from "./useSecret";

import type { AxiosResponse } from "axios";

vi.mock("~/api/api-client", () => ({
  ApiClient: { api: { envControllerGetEnvKey: vi.fn() } },
}));

const getEnvKey = vi.mocked(ApiClient.api.envControllerGetEnvKey);

const createAxiosError = (status: number) =>
  new AxiosError("Request failed", undefined, undefined, undefined, { status } as AxiosResponse);

const fetchSecret = (secretName: string) =>
  new QueryClient().fetchQuery(secretQueryOptions(secretName, true));

describe("secretQueryOptions", () => {
  beforeEach(() => {
    getEnvKey.mockReset();
  });

  it("returns the stored secret", async () => {
    getEnvKey.mockResolvedValue({
      data: { data: { name: "SLACK_CLIENT_ID", value: "client-id" } },
    } as Awaited<ReturnType<typeof getEnvKey>>);

    await expect(fetchSecret("SLACK_CLIENT_ID")).resolves.toEqual({
      data: { name: "SLACK_CLIENT_ID", value: "client-id" },
    });
  });

  it("treats a secret that was never set as empty", async () => {
    getEnvKey.mockRejectedValue(createAxiosError(404));

    await expect(fetchSecret("SLACK_CLIENT_ID")).resolves.toEqual({
      data: { name: "SLACK_CLIENT_ID", value: "" },
    });
  });

  it("still fails when the secret cannot be loaded", async () => {
    getEnvKey.mockRejectedValue(createAxiosError(500));

    await expect(fetchSecret("SLACK_CLIENT_ID")).rejects.toBeInstanceOf(AxiosError);
  });
});
