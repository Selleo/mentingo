import { CompetenciesApiError } from "@mentingo/competencies-sdk";
import { NotFoundException, PayloadTooLargeException } from "@nestjs/common";

import { dbAls } from "src/storage/db/db-als.store";

import { CompetenciesClientService } from "./competencies-client.service";

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
});
