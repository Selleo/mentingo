import { createHash } from "node:crypto";

import { ScormContentGrantService } from "./scorm-content-grant.service";

describe("SCORM delivery grants", () => {
  const actor = {
    userId: "user",
    tenantId: "tenant",
    email: "u@example.test",
    roleSlugs: [],
    permissions: [],
  } as unknown as import("src/common/types/current-user.type").CurrentUserType;
  const store = new Map<string, string>();
  const redis = {
    set: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    get: jest.fn(async (key: string) => store.get(key) || null),
    exists: jest.fn(async (key: string) => Number(store.has(key))),
  };
  const service = new ScormContentGrantService(redis as never);
  beforeEach(() => {
    store.clear();
    jest.clearAllMocks();
  });
  it("stores only a digest of the bearer token and rejects malformed or expired grants", async () => {
    const token = await service.create({
      actor,
      credential: "jwt-secret",
      credentialExpiresAt: Date.now() + 60_000,
      packageId: "pkg",
      extractedFilesReference: "tenant/pkg/extracted",
      launchPath: "index.html",
      parentOrigin: "https://lms.example",
    });
    expect(token).toMatch(/^[a-f0-9]{64}$/u);
    expect([...store.keys()][0]).not.toContain(token);
    expect(await service.read("bad")).toBeNull();
    expect(await service.read(token)).not.toBeNull();
    const saved = JSON.parse([...store.values()][0]);
    saved.expiresAt = Date.now() - 1;
    store.set([...store.keys()][0], JSON.stringify(saved));
    expect(await service.read(token)).toBeNull();
  });
  it("caps support grants and refuses renewal by another actor", async () => {
    const support = {
      ...actor,
      isSupportMode: true,
      supportExpiresAt: new Date(Date.now() + 1000).toISOString(),
    } as never;
    const token = await service.create({
      actor: support,
      credential: "jwt-secret",
      credentialExpiresAt: Date.now() + 60_000,
      packageId: "pkg",
      extractedFilesReference: "tenant/pkg/extracted",
      launchPath: "index.html",
      parentOrigin: "https://lms.example",
    });
    expect((await service.read(token))!.expiresAt).toBeLessThanOrEqual(Date.now() + 1000);
    await expect(
      service.renew(token, { ...actor, userId: "other" } as never, "jwt-secret"),
    ).rejects.toThrow();
    await expect(
      service.renew(token, support, "a different login's access token"),
    ).rejects.toThrow();
  });
  it("stops serving when logout revokes the bound access credential", async () => {
    const token = await service.create({
      actor,
      credential: "bound-access-token",
      credentialExpiresAt: Date.now() + 60_000,
      packageId: "pkg",
      extractedFilesReference: "tenant/pkg/extracted",
      launchPath: "index.html",
      parentOrigin: "https://lms.example",
    });
    const digest = createHash("sha256").update("bound-access-token").digest("hex");
    store.set(`scorm:credential-revoked:${digest}`, "1");
    expect(await service.read(token)).toBeNull();
  });
});
