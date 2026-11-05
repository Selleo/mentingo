import { createHash, randomBytes } from "node:crypto";

import { ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { SCORM_CONTENT_ACCESS, SCORM_CONTENT_PATHS, SCORM_CONTENT_TOKEN } from "@repo/shared";

import { REDIS_CLIENT, RedisClient, SessionRevocationService } from "src/redis";

import { getScormContentOrigin } from "./scorm-content.config";
import { SCORM_CONTENT_CONFIG, SCORM_CONTENT_ERROR_KEYS } from "./scorm-content.constants";

import type { ScormContentGrant, ScormContentGrantInput } from "./scorm-content.types";
import type { CurrentUserType } from "src/common/types/current-user.type";

const contentTokenPattern = new RegExp(SCORM_CONTENT_TOKEN.PATTERN);

/** Short-lived, opaque grants that let the isolated SCORM origin serve one package to one actor. */
@Injectable()
export class ScormContentGrantsService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    private readonly sessionRevocationService: SessionRevocationService,
  ) {}

  async createGrantedContentUrl(grant: ScormContentGrantInput): Promise<string> {
    const contentOrigin = getScormContentOrigin();
    this.assertIsolatedParentOrigin(grant.parentOrigin, contentOrigin);

    const token = randomBytes(SCORM_CONTENT_TOKEN.BYTE_LENGTH).toString("hex");
    await this.storeGrant(token, grant);

    return `${contentOrigin}${SCORM_CONTENT_PATHS.PREFIX}${token}/${SCORM_CONTENT_PATHS.PLAYER}`;
  }

  async findActiveGrant(token: string): Promise<ScormContentGrant> {
    if (!contentTokenPattern.test(token)) {
      throw new UnauthorizedException(SCORM_CONTENT_ERROR_KEYS.ACCESS_EXPIRED);
    }

    const storedGrant = await this.redis.get(this.getGrantRedisKey(token));
    if (!storedGrant) throw new UnauthorizedException(SCORM_CONTENT_ERROR_KEYS.ACCESS_EXPIRED);

    const grant = JSON.parse(storedGrant) as ScormContentGrant;
    if (grant.expiresAt <= Date.now()) {
      throw new UnauthorizedException(SCORM_CONTENT_ERROR_KEYS.ACCESS_EXPIRED);
    }

    await this.sessionRevocationService.assertSessionActive(grant.actor);
    return grant;
  }

  async extendGrantForActor(token: string, actor: CurrentUserType): Promise<void> {
    const grant = await this.findActiveGrant(token);

    if (grant.actor.userId !== actor.userId || grant.actor.tenantId !== actor.tenantId) {
      throw new ForbiddenException(SCORM_CONTENT_ERROR_KEYS.FORBIDDEN);
    }

    await this.storeGrant(token, { ...grant, actor });
  }

  private assertIsolatedParentOrigin(parentOrigin: string, contentOrigin: string): void {
    if (new URL(parentOrigin).origin !== parentOrigin || parentOrigin === contentOrigin) {
      throw new ForbiddenException(SCORM_CONTENT_ERROR_KEYS.UNAVAILABLE);
    }
  }

  private getGrantExpiresAt(actor: CurrentUserType): number {
    const defaultExpiresAt = Date.now() + SCORM_CONTENT_ACCESS.GRANT_TTL_SECONDS * 1000;
    if (!actor.isSupportMode || !actor.supportExpiresAt) return defaultExpiresAt;

    return Math.min(defaultExpiresAt, new Date(actor.supportExpiresAt).getTime());
  }

  private async storeGrant(token: string, grant: ScormContentGrantInput): Promise<void> {
    const expiresAt = this.getGrantExpiresAt(grant.actor);
    const ttlMs = Math.ceil(expiresAt - Date.now());

    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new UnauthorizedException(SCORM_CONTENT_ERROR_KEYS.ACCESS_EXPIRED);
    }

    await this.redis.set(this.getGrantRedisKey(token), JSON.stringify({ ...grant, expiresAt }), {
      PX: ttlMs,
    });
  }

  private getGrantRedisKey(token: string): string {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    return `${SCORM_CONTENT_CONFIG.REDIS_KEY_PREFIX}${tokenHash}`;
  }
}
