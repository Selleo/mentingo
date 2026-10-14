import { createHash } from "node:crypto";

import { McpTokenService } from "./mcp-token.service";

import type { McpAccessGrant } from "./mcp.types";

const resourceUrl = "https://tenant.example.com/api/mcp";
const grant: Omit<McpAccessGrant, "expiresAt"> = {
  userId: "11111111-1111-4111-8111-111111111111",
  tenantId: "22222222-2222-4222-8222-222222222222",
  clientId: "client",
  resource: resourceUrl,
  scopes: ["search"],
};

function tokenKey(token: string): string {
  return `mcp:access:${createHash("sha256").update(token).digest("hex")}`;
}

function buildService() {
  const values = new Map<string, string>();
  const redis = {
    set: jest.fn((key: string, value: string) => {
      values.set(key, value);
      return Promise.resolve("OK");
    }),
    get: jest.fn((key: string) => Promise.resolve(values.get(key) ?? null)),
    del: jest.fn(),
  };
  const resources = {
    forTenant: jest.fn(() => Promise.resolve({ url: resourceUrl })),
  };
  const service = new McpTokenService(redis as never, {} as never, resources as never, {} as never);
  const identity = jest.spyOn(service, "resolveIdentity").mockResolvedValue("actor@example.com");
  return { service, redis, values, resources, identity };
}

describe("McpTokenService integration scopes", () => {
  it.each(["authoring", "search", "student:read", "search:read", "courses:read"])(
    "stores and resolves %s with tenant/resource identity checks",
    async (scope) => {
      const { service, values, resources, identity } = buildService();
      await service.store("token", { ...grant, scopes: [scope] });
      expect(JSON.parse(values.get(tokenKey("token"))!).scopes).toEqual([scope]);
      const actor = await service.resolve("token", resourceUrl);
      expect(actor).toEqual({
        email: "actor@example.com",
        grant: expect.objectContaining({ ...grant, scopes: [scope] }),
      });
      expect(resources.forTenant).toHaveBeenCalledWith(grant.tenantId);
      expect(identity).toHaveBeenCalledWith(grant.userId, grant.tenantId);
    },
  );

  it.each([
    undefined,
    null,
    "authoring",
    [],
    ["unknown"],
    ["search", "authoring"],
    ["search", "search"],
  ])(
    "rejects malformed or unsupported stored scopes %p without resolving identity",
    async (scopes) => {
      const { service, values, identity } = buildService();
      values.set(
        tokenKey("token"),
        JSON.stringify({ ...grant, scopes, expiresAt: Date.now() + 60000 }),
      );
      expect(await service.resolve("token", resourceUrl)).toBeNull();
      expect(identity).not.toHaveBeenCalled();
    },
  );

  it("refuses to combine legacy and explicit scopes", async () => {
    const { service, redis } = buildService();
    await expect(
      service.store("token", { ...grant, scopes: ["search", "authoring"] }),
    ).rejects.toThrow("Invalid MCP token scope");
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("preserves a granular multi-scope grant without granting student access", async () => {
    const { service } = buildService();
    const scopes = ["courses:read", "articles:read", "files:write"];
    await service.store("token", { ...grant, scopes });
    expect((await service.resolve("token", resourceUrl))?.grant.scopes).toEqual(scopes);
  });

  it("does not let search scope bypass resource, expiry, or active identity checks", async () => {
    const { service, values, identity } = buildService();
    await service.store("token", grant);
    expect(await service.resolve("token", "https://another.example.com/api/mcp")).toBeNull();
    expect(identity).not.toHaveBeenCalled();
    identity.mockResolvedValue(null);
    expect(await service.resolve("token", resourceUrl)).toBeNull();
    values.set(tokenKey("token"), JSON.stringify({ ...grant, expiresAt: Date.now() - 1 }));
    identity.mockClear();
    expect(await service.resolve("token", resourceUrl)).toBeNull();
    expect(identity).not.toHaveBeenCalled();
  });

  it("rejects a grant whose stored resource no longer matches the tenant", async () => {
    const { service, resources, identity } = buildService();
    await service.store("token", grant);
    resources.forTenant.mockResolvedValue({ url: "https://changed.example.com/api/mcp" });
    expect(await service.resolve("token", resourceUrl)).toBeNull();
    expect(identity).not.toHaveBeenCalled();
  });
});
