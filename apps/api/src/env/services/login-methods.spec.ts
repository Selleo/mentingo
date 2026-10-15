import { NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { EnvService } from "./env.service";

import type { EnvRepository } from "../repositories/env.repository";

const createService = (values: Record<string, string> = {}, enforceSSO = false) => {
  process.env.MASTER_KEY = Buffer.alloc(32).toString("base64");
  const service = new EnvService(
    {
      getEnforceSSO: async () => enforceSSO,
      withLoginMethodsLock: async (fn: () => Promise<unknown>) => fn(),
    } as unknown as EnvRepository,
    new ConfigService(),
  );
  jest.spyOn(service, "getEnv").mockImplementation(async (name) => {
    if (!(name in values)) throw new NotFoundException("Secret not found");
    return { name, value: values[name] };
  });
  return service;
};

describe("organization login methods", () => {
  it("fails closed instead of enabling defaults when secret storage fails", async () => {
    const service = createService();
    jest.spyOn(service, "getEnv").mockRejectedValue(new Error("storage unavailable"));
    await expect(service.getLoginMethods()).rejects.toThrow("storage unavailable");
  });
  it("serializes the read-check-write to avoid concurrent lockout", async () => {
    const service = createService();
    const repository = (service as any).envRepository;
    const lock = jest.spyOn(repository, "withLoginMethodsLock");
    jest.spyOn(service, "bulkUpsertEnv").mockResolvedValue(undefined);
    await service.updateLoginMethod({ method: "password", enabled: false });
    expect(lock).toHaveBeenCalledTimes(1);
  });
  it("refuses an unconfigured provider and never saves partial credentials", async () => {
    const service = createService();
    const save = jest.spyOn(service, "bulkUpsertEnv").mockResolvedValue(undefined);
    await expect(
      (service as any).updateLoginMethod({
        method: "microsoft",
        enabled: true,
        configuration: [{ name: "MICROSOFT_CLIENT_ID", value: "id" }],
      }),
    ).rejects.toThrow();
    expect(save).not.toHaveBeenCalled();
  });
  it("saves only Microsoft login credentials and both enable flags together", async () => {
    const service = createService();
    const save = jest.spyOn(service, "bulkUpsertEnv").mockResolvedValue(undefined);
    await service.updateLoginMethod({
      method: "microsoft",
      enabled: true,
      configuration: [
        { name: "MICROSOFT_CLIENT_ID", value: "id" },
        { name: "MICROSOFT_CLIENT_SECRET", value: "secret" },
      ],
    });
    expect(save).toHaveBeenCalledWith(
      [
        { name: "MICROSOFT_CLIENT_ID", value: "id" },
        { name: "MICROSOFT_CLIENT_SECRET", value: "secret" },
        { name: "MICROSOFT_OAUTH_ENABLED", value: "true" },
        { name: "VITE_MICROSOFT_OAUTH_ENABLED", value: "true" },
      ],
      undefined,
    );
  });
  it("cannot disable the last usable login method", async () => {
    const service = createService({ MAGIC_LINK_LOGIN_ENABLED: "false" });
    const save = jest.spyOn(service, "bulkUpsertEnv").mockResolvedValue(undefined);
    await expect(service.updateLoginMethod({ method: "password", enabled: false })).rejects.toThrow(
      "loginMethods.errors.lastMethod",
    );
    expect(save).not.toHaveBeenCalled();
  });
  it("does not count an enabled but unconfigured OAuth provider as a lockout escape", async () => {
    const service = createService({
      GOOGLE_OAUTH_ENABLED: "true",
      MAGIC_LINK_LOGIN_ENABLED: "false",
    });
    jest.spyOn(service, "bulkUpsertEnv").mockResolvedValue(undefined);
    await expect(service.updateLoginMethod({ method: "password", enabled: false })).rejects.toThrow(
      "loginMethods.errors.lastMethod",
    );
  });
  it("reports only missing authentication credentials, not calendar credentials or secret values", async () => {
    const service = createService({ MICROSOFT_CLIENT_ID: "existing-id" });
    const setup = await (service as any).getLoginMethodSetup();
    expect(setup.missing.microsoft).toEqual(["MICROSOFT_CLIENT_SECRET"]);
    expect(JSON.stringify(setup)).not.toContain("existing-id");
  });
  it("does not count password when SSO enforcement prevents password login", async () => {
    const service = createService({}, true);
    jest.spyOn(service, "bulkUpsertEnv").mockResolvedValue(undefined);
    await expect(
      service.updateLoginMethod({ method: "magicLink", enabled: false }),
    ).rejects.toThrow("loginMethods.errors.lastMethod");
  });
  it("preserves password and magic-link defaults and exposes no provider secrets", async () => {
    const service = createService({ GOOGLE_CLIENT_SECRET: "private-value" });
    const methods = await (service as any).getLoginMethods();
    expect(methods.password).toBe(true);
    expect(methods.magicLink).toBe(true);
    expect(methods.google).toBe(false);
    expect(JSON.stringify(methods)).not.toContain("private-value");
  });
});
