import { NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PERMISSIONS } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import { ALLOWED_SECRETS } from "src/env/env.config";
import { EnvService } from "src/env/services/env.service";
import { dbAls } from "src/storage/db/db-als.store";

import { IntegrationService } from "./integration.service";
import { integrationUpdateTenantApiKeysSchema } from "./schemas/integration-tenant-api-keys.schema";

import type { CurrentUserType } from "src/common/types/current-user.type";
import type { EncryptedEnvBody } from "src/env/env.schema";
import type { EnvRepository } from "src/env/repositories/env.repository";

jest.mock("src/permissions/permissions.service", () => ({ PermissionsService: class {} }));
jest.mock("src/super-admin/tenants.service", () => ({ TenantsService: class {} }));
jest.mock("./integration.repository", () => ({ IntegrationRepository: class {} }));

describe("Integration tenant API key updates", () => {
  const tenantId = "00000000-0000-4000-8000-000000000001";
  const managingTenantId = "00000000-0000-4000-8000-000000000002";
  const apiKey = "test-only-luma-key";
  const keyTenant = { tenantId: managingTenantId, isManaging: true };
  const actor: CurrentUserType = {
    userId: "00000000-0000-4000-8000-000000000003",
    email: "operator@example.test",
    tenantId: managingTenantId,
    roleSlugs: [],
    permissions: [PERMISSIONS.INTEGRATION_API_USE, PERMISSIONS.TENANT_MANAGE],
  };

  function createService() {
    const persisted = new Map<string, EncryptedEnvBody>();
    const getTenantById = jest.fn().mockResolvedValue({ id: tenantId });
    const bulkUpsertEnv = jest.fn(async (envs: EncryptedEnvBody[]) => {
      for (const env of envs) persisted.set(`${dbAls.getStore()?.tenantId}:${env.name}`, env);
    });
    const getEnv = jest.fn(async (name: string) => {
      const env = persisted.get(`${dbAls.getStore()?.tenantId}:${name}`);
      if (!env) return undefined;
      return { ...env, encryptedDekIV: env.dekIv, encryptedDekTag: env.dekTag };
    });
    const publish = jest.fn().mockResolvedValue(undefined);
    const envService = new EnvService(
      { bulkUpsertEnv, getEnv } as unknown as EnvRepository,
      new ConfigService(),
      { publish } as never,
    );
    const runWithTenantTransaction = jest.fn((id: string, callback: () => Promise<void>) =>
      dbAls.run({ tenantId: id }, callback),
    );
    const service = new IntegrationService(
      { getTenantById } as never,
      undefined as never,
      undefined as never,
      undefined as never,
      envService,
      { runWithTenantTransaction } as never,
    );
    return {
      service,
      envService,
      persisted,
      getTenantById,
      bulkUpsertEnv,
      publish,
      runWithTenantTransaction,
    };
  }

  it("encrypts only the path tenant's key and returns no secret", async () => {
    const { service, envService, persisted, runWithTenantTransaction, publish } = createService();
    const result = await service.updateTenantApiKeysForIntegration(
      tenantId,
      { name: "LUMA_API_KEY", value: apiKey },
      actor,
      keyTenant,
    );

    expect(runWithTenantTransaction).toHaveBeenCalledWith(tenantId, expect.any(Function));
    expect(result).toEqual({ tenantId, updatedKeys: ["LUMA_API_KEY"] });
    expect(persisted.has(`${managingTenantId}:LUMA_API_KEY`)).toBe(false);
    expect(JSON.stringify([...persisted.values()])).not.toContain(apiKey);
    await expect(dbAls.run({ tenantId }, () => envService.getEnv("LUMA_API_KEY"))).resolves.toEqual(
      { name: "LUMA_API_KEY", value: apiKey },
    );
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        updateEnvData: { actor: { ...actor, tenantId }, updatedEnvKeys: ["LUMA_API_KEY"] },
      }),
    );
    expect(JSON.stringify(publish.mock.calls)).not.toContain(apiKey);
    expect(actor.tenantId).toBe(managingTenantId);
  });

  it("replaces the selected key without changing a different tenant's key", async () => {
    const { service, envService } = createService();
    await service.updateTenantApiKeysForIntegration(
      managingTenantId,
      { name: "LUMA_API_KEY", value: "original-key" },
      actor,
      keyTenant,
    );
    await service.updateTenantApiKeysForIntegration(
      tenantId,
      { name: "LUMA_API_KEY", value: apiKey },
      actor,
      keyTenant,
    );
    await service.updateTenantApiKeysForIntegration(
      tenantId,
      { name: "LUMA_API_KEY", value: "replacement-key" },
      actor,
      keyTenant,
    );
    await expect(dbAls.run({ tenantId }, () => envService.getEnv("LUMA_API_KEY"))).resolves.toEqual(
      { name: "LUMA_API_KEY", value: "replacement-key" },
    );
    await expect(
      dbAls.run({ tenantId: managingTenantId }, () => envService.getEnv("LUMA_API_KEY")),
    ).resolves.toEqual({ name: "LUMA_API_KEY", value: "original-key" });
  });

  it("uses the path tenant instead of an actor tenant set by an optional header", async () => {
    const { service, runWithTenantTransaction } = createService();
    await service.updateTenantApiKeysForIntegration(
      tenantId,
      { name: "LUMA_API_KEY", value: apiKey },
      { ...actor, tenantId: "header-tenant" },
      keyTenant,
    );
    expect(runWithTenantTransaction).toHaveBeenCalledWith(tenantId, expect.any(Function));
  });

  it.each([
    {
      label: "missing tenant permission",
      actor: { ...actor, permissions: [PERMISSIONS.INTEGRATION_API_USE] },
      keyTenant,
    },
    { label: "non-managing key owner", actor, keyTenant: { ...keyTenant, isManaging: false } },
  ])(
    "rejects $label before any lookup or write",
    async ({ actor: deniedActor, keyTenant: deniedKeyTenant }) => {
      const { service, getTenantById, bulkUpsertEnv, runWithTenantTransaction } = createService();
      await expect(
        service.updateTenantApiKeysForIntegration(
          tenantId,
          { name: "LUMA_API_KEY", value: apiKey },
          deniedActor,
          deniedKeyTenant,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(getTenantById).not.toHaveBeenCalled();
      expect(runWithTenantTransaction).not.toHaveBeenCalled();
      expect(bulkUpsertEnv).not.toHaveBeenCalled();
    },
  );

  it("rejects a nonexistent target without writing", async () => {
    const { service, getTenantById, bulkUpsertEnv } = createService();
    getTenantById.mockResolvedValue(undefined);
    await expect(
      service.updateTenantApiKeysForIntegration(
        tenantId,
        { name: "LUMA_API_KEY", value: apiKey },
        actor,
        keyTenant,
      ),
    ).rejects.toThrow("superAdminTenants.error.notFound");
    expect(bulkUpsertEnv).not.toHaveBeenCalled();
  });

  it("propagates storage failure without publishing success", async () => {
    const { service, bulkUpsertEnv, publish } = createService();
    bulkUpsertEnv.mockRejectedValue(new Error("storage unavailable"));
    await expect(
      service.updateTenantApiKeysForIntegration(
        tenantId,
        { name: "LUMA_API_KEY", value: apiKey },
        actor,
        keyTenant,
      ),
    ).rejects.toThrow("storage unavailable");
    expect(publish).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { name: "LUMA_API_KEY" },
    { value: "test-key" },
    { name: "MASTER_KEY", value: "forbidden" },
    { name: "UNKNOWN_ENV", value: "forbidden" },
    { name: "LUMA_API_KEY", value: null },
    { name: "LUMA_API_KEY", value: 12 },
    { name: "LUMA_API_KEY", value: "a".repeat(4097) },
    { MASTER_KEY: "forbidden" },
    { name: "LUMA_API_KEY", value: apiKey, MASTER_KEY: "forbidden" },
    { name: "LUMA_API_KEY", value: apiKey, tenantId },
  ])("rejects invalid or non-allowlisted request %#", (body) => {
    expect(Value.Check(integrationUpdateTenantApiKeysSchema, body)).toBe(false);
  });

  it("accepts a valid selected key", () => {
    expect(
      Value.Check(integrationUpdateTenantApiKeysSchema, { name: "LUMA_API_KEY", value: apiKey }),
    ).toBe(true);
  });

  it.each(ALLOWED_SECRETS)("accepts supported environment %s", (name) => {
    expect(Value.Check(integrationUpdateTenantApiKeysSchema, { name, value: "test value" })).toBe(
      true,
    );
  });

  it("updates a non-Luma environment without overwriting the tenant's Luma key", async () => {
    const { service, envService, publish } = createService();
    await service.updateTenantApiKeysForIntegration(
      tenantId,
      { name: "LUMA_API_KEY", value: apiKey },
      actor,
      keyTenant,
    );
    await expect(
      service.updateTenantApiKeysForIntegration(
        tenantId,
        { name: "OPENAI_API_KEY", value: "openai-test-key" },
        actor,
        keyTenant,
      ),
    ).resolves.toEqual({ tenantId, updatedKeys: ["OPENAI_API_KEY"] });
    await expect(
      dbAls.run({ tenantId }, () => envService.getEnv("OPENAI_API_KEY")),
    ).resolves.toEqual({ name: "OPENAI_API_KEY", value: "openai-test-key" });
    await expect(dbAls.run({ tenantId }, () => envService.getEnv("LUMA_API_KEY"))).resolves.toEqual(
      { name: "LUMA_API_KEY", value: apiKey },
    );
    expect(publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        updateEnvData: { actor: { ...actor, tenantId }, updatedEnvKeys: ["OPENAI_API_KEY"] },
      }),
    );
    expect(JSON.stringify(publish.mock.calls)).not.toContain("openai-test-key");
  });

  it("allows empty and multiline values like the existing environment API", async () => {
    const { service, envService } = createService();
    for (const value of ["", "line one\nline two"]) {
      expect(
        Value.Check(integrationUpdateTenantApiKeysSchema, { name: "OPENAI_API_KEY", value }),
      ).toBe(true);
      await service.updateTenantApiKeysForIntegration(
        tenantId,
        { name: "OPENAI_API_KEY", value },
        actor,
        keyTenant,
      );
      await expect(
        dbAls.run({ tenantId }, () => envService.getEnv("OPENAI_API_KEY")),
      ).resolves.toEqual({ name: "OPENAI_API_KEY", value });
    }
  });

  it("rejects unsupported names in the service even when schema validation is bypassed", async () => {
    const { service, bulkUpsertEnv, publish } = createService();
    await expect(
      service.updateTenantApiKeysForIntegration(
        tenantId,
        { name: "MASTER_KEY", value: "forbidden" },
        actor,
        keyTenant,
      ),
    ).rejects.toThrow("Secret not supported");
    expect(bulkUpsertEnv).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
});
