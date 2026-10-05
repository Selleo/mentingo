import { createHash, randomBytes } from "node:crypto";

import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { SCORM_TOKEN_PATTERN } from "@repo/shared";

import { REDIS_CLIENT, type RedisClient } from "src/redis";

import type { CurrentUserType } from "src/common/types/current-user.type";

const TTL_MS = 15 * 60 * 1000;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export type ScormGrant = {
  actor: CurrentUserType;
  credentialDigest: string;
  packageId: string;
  extractedFilesReference: string;
  launchPath: string;
  parentOrigin: string;
  expiresAt: number;
};

@Injectable()
export class ScormContentGrantService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}
  private key(token: string) {
    return `scorm:content:${digest(token)}`;
  }
  private revokedKey(credentialDigest: string) {
    return `scorm:credential-revoked:${credentialDigest}`;
  }

  async create(params: {
    actor: CurrentUserType;
    credential: string;
    credentialExpiresAt: number;
    packageId: string;
    extractedFilesReference: string;
    launchPath: string;
    parentOrigin: string;
  }) {
    const token = randomBytes(32).toString("hex");
    const supportExpiry = params.actor.isSupportMode
      ? Date.parse(params.actor.supportExpiresAt || "")
      : Infinity;
    const expiresAt = Math.min(Date.now() + TTL_MS, params.credentialExpiresAt, supportExpiry);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || !params.credential)
      throw new ForbiddenException();
    const grant: ScormGrant = {
      actor: params.actor,
      credentialDigest: digest(params.credential),
      packageId: params.packageId,
      extractedFilesReference: params.extractedFilesReference,
      launchPath: params.launchPath,
      parentOrigin: params.parentOrigin,
      expiresAt,
    };
    await this.redis.set(this.key(token), JSON.stringify(grant), { PX: expiresAt - Date.now() });
    return token;
  }

  async read(token: string): Promise<ScormGrant | null> {
    if (!SCORM_TOKEN_PATTERN.test(token)) return null;
    const raw = await this.redis.get(this.key(token));
    if (!raw) return null;
    const grant = JSON.parse(raw) as ScormGrant;
    if (
      grant.expiresAt <= Date.now() ||
      !grant.actor?.tenantId ||
      !grant.actor?.userId ||
      (await this.redis.exists(this.revokedKey(grant.credentialDigest)))
    )
      return null;
    return grant;
  }

  async renew(token: string, actor: CurrentUserType, credential: string): Promise<ScormGrant> {
    const grant = await this.read(token);
    if (
      !grant ||
      grant.actor.userId !== actor.userId ||
      grant.actor.tenantId !== actor.tenantId ||
      grant.actor.supportSessionId !== actor.supportSessionId ||
      !credential ||
      grant.credentialDigest !== digest(credential)
    )
      throw new ForbiddenException();
    const expiresAt = Math.min(
      Date.now() + TTL_MS,
      actor.exp ? actor.exp * 1000 : grant.expiresAt,
      actor.isSupportMode ? Date.parse(actor.supportExpiresAt || "") : Infinity,
    );
    if (expiresAt <= Date.now()) throw new ForbiddenException();
    const renewed = { ...grant, expiresAt };
    await this.redis.set(this.key(token), JSON.stringify(renewed), { PX: expiresAt - Date.now() });
    return renewed;
  }

  async revokeCredential(credential: string, expiresAt: number) {
    const ttl = expiresAt - Date.now();
    if (credential && ttl > 0)
      await this.redis.set(this.revokedKey(digest(credential)), "1", { PX: ttl });
  }
}
