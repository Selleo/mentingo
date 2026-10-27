import { lookup } from "node:dns/promises";

import { CompetenciesApiError } from "@mentingo/competencies-sdk";
import { ForbiddenException, NotFoundException, PayloadTooLargeException } from "@nestjs/common";

import { dbAls } from "src/storage/db/db-als.store";

import { CompetenciesClientService } from "./competencies-client.service";

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));

describe("CompetenciesClientService.isConfigured", () => {
  function setup(getEnv: jest.Mock) {
    return new CompetenciesClientService({ getEnv } as never);
  }

  it("returns false without a tenant context", async () => {
    const getEnv = jest.fn();
    await expect(setup(getEnv).isConfigured()).resolves.toBe(false);
    expect(getEnv).not.toHaveBeenCalled();
  });

  it("treats missing and blank tenant values as unconfigured", async () => {
    const getEnv = jest.fn(async (name: string) => {
      if (name === "COMPETENCIES_API_KEY") throw new NotFoundException();
      return { value: "https://competencies.example.test" };
    });
    await expect(
      dbAls.run({ tenantId: "tenant" }, () => setup(getEnv).isConfigured()),
    ).resolves.toBe(false);

    getEnv.mockImplementation(async (name: string) => ({
      value: name === "COMPETENCIES_API_KEY" ? "  " : "https://competencies.example.test",
    }));
    await expect(
      dbAls.run({ tenantId: "tenant" }, () => setup(getEnv).isConfigured()),
    ).resolves.toBe(false);
  });

  it("returns true when both tenant values are present", async () => {
    const getEnv = jest.fn(async (name: string) => ({
      value:
        name === "COMPETENCIES_API_KEY" ? "configured-key" : "https://competencies.example.test",
    }));
    await expect(
      dbAls.run({ tenantId: "tenant" }, () => setup(getEnv).isConfigured()),
    ).resolves.toBe(true);
  });

  it("propagates tenant configuration storage errors so outbox intake can retry", async () => {
    const failure = new Error("configuration store unavailable");
    const getEnv = jest.fn().mockRejectedValue(failure);
    await expect(
      dbAls.run({ tenantId: "tenant" }, () => setup(getEnv).isConfigured()),
    ).rejects.toBe(failure);
  });

  it("preserves an oversized attachment request as HTTP 413", async () => {
    const service = setup(jest.fn());
    jest.spyOn(service, "client").mockResolvedValue({} as never);
    await expect(
      service.run(async () => {
        throw new CompetenciesApiError(413);
      }),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it("rechecks a saved plugin hostname before each request when its DNS changes", async () => {
    jest
      .mocked(lookup)
      .mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }] as never)
      .mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }] as never);
    const fetch = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ capabilities: { competencies: { enabled: true } } }));
    const service = setup(
      jest.fn(async (name: string) => ({
        value:
          name === "COMPETENCIES_BASE_URL"
            ? "https://plugins.example.test"
            : "test-only-plugin-key",
      })),
    );

    try {
      await dbAls.run({ tenantId: "tenant" }, async () => {
        await expect(service.run((client) => client.configuration())).resolves.toEqual({
          capabilities: { competencies: { enabled: true } },
        });
        await expect(service.run((client) => client.configuration())).rejects.toBeInstanceOf(
          ForbiddenException,
        );
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      fetch.mockRestore();
    }
  });
});
