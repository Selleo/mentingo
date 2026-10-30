import { lookup } from "node:dns/promises";

import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PERMISSIONS } from "@repo/shared";

import { EnvService } from "src/env/services/env.service";

import { IntegrationService } from "./integration.service";

import type { CurrentUserType } from "src/common/types/current-user.type";
import type { EncryptedEnvBody } from "src/env/env.schema";

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));
jest.mock("src/permissions/permissions.service", () => ({ PermissionsService: class {} }));
jest.mock("src/super-admin/tenants.service", () => ({ TenantsService: class {} }));
jest.mock("./integration.repository", () => ({ IntegrationRepository: class {} }));

describe("Competencies connection origins", () => {
  const tenantId = "00000000-0000-4000-8000-000000000001";
  const actor: CurrentUserType = {
    tenantId,
    userId: "00000000-0000-4000-8000-000000000002",
    email: "operator@example.test",
    permissions: [PERMISSIONS.INTEGRATION_API_USE, PERMISSIONS.TENANT_MANAGE],
    roleSlugs: [],
  };
  const keyTenant = { tenantId, isManaging: true };

  function setup() {
    const persisted = new Map<string, EncryptedEnvBody>();
    const bulkUpsertEnv = jest.fn(async (values: EncryptedEnvBody[]) => {
      for (const value of values) persisted.set(value.name, value);
    });
    const runWithTenantTransaction = jest.fn((_id: string, run: () => Promise<void>) => run());
    const getEnv = jest.fn(async (name: string) => ({
      ...persisted.get(name),
      encryptedDekIV: persisted.get(name)?.dekIv,
      encryptedDekTag: persisted.get(name)?.dekTag,
    }));
    const envService = new EnvService({ bulkUpsertEnv, getEnv } as never, new ConfigService());
    const service = new IntegrationService(
      { getTenantById: jest.fn().mockResolvedValue({ id: tenantId }) } as never,
      undefined as never,
      undefined as never,
      undefined as never,
      envService,
      { runWithTenantTransaction, runWithTenant: runWithTenantTransaction } as never,
    );
    return { service, envService, bulkUpsertEnv, runWithTenantTransaction };
  }

  beforeEach(() => {
    jest.mocked(lookup).mockReset();
    jest.mocked(lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
  });

  it.each(["http://localhost:3100", "https://plugins.example.test"])(
    "saves an allowed origin: %s",
    async (baseUrl) => {
      const { service, envService, bulkUpsertEnv, runWithTenantTransaction } = setup();
      await expect(
        service.configureCompetenciesConnection(
          tenantId,
          { baseUrl, apiKey: "test-only-plugin-key" },
          actor,
          keyTenant,
        ),
      ).resolves.toEqual({ tenantId });
      expect(runWithTenantTransaction).toHaveBeenCalledWith(tenantId, expect.any(Function));
      expect(bulkUpsertEnv).toHaveBeenCalledTimes(1);
      await expect(envService.getEnv("COMPETENCIES_BASE_URL")).resolves.toEqual({
        name: "COMPETENCIES_BASE_URL",
        value: baseUrl,
      });
      expect(JSON.stringify(bulkUpsertEnv.mock.calls)).not.toContain("test-only-plugin-key");
    },
  );

  it.each(["127.0.0.1", "10.0.0.5", "192.168.1.10", "::1"])(
    "rejects a plugin hostname resolving to %s before saving credentials",
    async (address) => {
      jest
        .mocked(lookup)
        .mockResolvedValue([{ address, family: address.includes(":") ? 6 : 4 }] as never);
      const { service, bulkUpsertEnv, runWithTenantTransaction } = setup();
      await expect(
        service.configureCompetenciesConnection(
          tenantId,
          { baseUrl: "https://plugins.example.test", apiKey: "test-only-plugin-key" },
          actor,
          keyTenant,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(bulkUpsertEnv).not.toHaveBeenCalled();
      expect(runWithTenantTransaction).not.toHaveBeenCalled();
    },
  );

  it("reports a saved blocked origin as unreachable without calling the plugin", async () => {
    jest.mocked(lookup).mockResolvedValue([{ address: "127.0.0.1", family: 4 }] as never);
    const fetch = jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Must not call"));
    try {
      const { service, envService } = setup();
      jest.spyOn(envService, "getEnv").mockImplementation(async (name) => ({
        name,
        value: name === "COMPETENCIES_BASE_URL" ? "https://plugins.example.test" : "test-only-key",
      }));
      await expect(
        service.competenciesConnectionStatus(tenantId, actor, keyTenant),
      ).resolves.toEqual({ tenantId, reachable: false, enabled: false });
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });
});
