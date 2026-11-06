import { ForbiddenException, UnauthorizedException } from "@nestjs/common";

import { ScormContentGrantsService } from "./scorm-content-grants.service";

import type { ScormContentGrant } from "./scorm-content.types";
import type { SessionService } from "src/auth/session/session.service";
import type { RedisClient } from "src/redis";

describe("SCORM content grants", () => {
  const actor: ScormContentGrant["actor"] = {
    userId: "learner",
    tenantId: "tenant",
    permissions: [],
    email: "learner@example.test",
    roleSlugs: [],
  };
  let data: Map<string, string>;
  let revoked: boolean;
  let scormContentGrantsService: ScormContentGrantsService;

  beforeEach(() => {
    data = new Map();
    revoked = false;
    const redis = {
      get: jest.fn(async (key: string) => data.get(key) ?? null),
      set: jest.fn(async (key: string, value: string) => data.set(key, value)),
    } as unknown as RedisClient;
    scormContentGrantsService = new ScormContentGrantsService(redis, {
      assertDerivedSessionAssurance: async () => {
        if (revoked) throw new UnauthorizedException();
      },
    } as unknown as SessionService);
  });

  const create = async () => {
    const url = await scormContentGrantsService.createGrantedContentUrl({
      actor,
      packageId: "package",
      extractedFilesReference: "tenant/package/v1",
      launchPath: "index.html",
      parentOrigin: "https://app.lms.localhost",
    });
    return new URL(url).pathname.split("/")[4];
  };

  it("issues opaque, scoped grants rather than exposing the application actor", async () => {
    const token = await create();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(await scormContentGrantsService.findActiveGrant(token)).toMatchObject({
      actor,
      packageId: "package",
    });
    expect([...data.keys()][0]).not.toContain(token);
    await expect(scormContentGrantsService.findActiveGrant("0".repeat(64))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects expired grants and revoked sessions", async () => {
    const token = await create();
    revoked = true;
    await expect(scormContentGrantsService.findActiveGrant(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    revoked = false;
    const key = [...data.keys()][0];
    data.set(
      key,
      JSON.stringify({
        ...(await scormContentGrantsService.findActiveGrant(token)),
        expiresAt: Date.now() - 1,
      }),
    );
    await expect(scormContentGrantsService.findActiveGrant(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("requires both the owner and tenant for renewal", async () => {
    const token = await create();
    await expect(
      scormContentGrantsService.extendGrantForActor(token, { ...actor, userId: "other" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      scormContentGrantsService.extendGrantForActor(token, { ...actor, tenantId: "other" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      scormContentGrantsService.extendGrantForActor(token, actor),
    ).resolves.toBeUndefined();
  });

  it("refuses same-origin launches", async () => {
    await expect(
      scormContentGrantsService.createGrantedContentUrl({
        actor,
        packageId: "package",
        extractedFilesReference: "v1",
        launchPath: "index.html",
        parentOrigin: "https://scorm.lms.localhost",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
