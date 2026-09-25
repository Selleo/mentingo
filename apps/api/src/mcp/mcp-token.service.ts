import { createHash, randomBytes } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { TENANT_STATUSES } from "@repo/shared";
import { and, eq, isNull } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { REDIS_CLIENT, RedisClient, SessionRevocationService } from "src/redis";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { credentials, tenants, users } from "src/storage/schema";

import { McpResourceService } from "./mcp-resource.service";

import type { McpAccessGrant, McpToolActor } from "./mcp.types";

const TOKEN_TTL_SECONDS = 60 * 60;

@Injectable()
export class McpTokenService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    private readonly resources: McpResourceService,
    private readonly revocation: SessionRevocationService,
  ) {}

  async issue(grant: Omit<McpAccessGrant, "expiresAt">): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await this.store(token, grant);
    return token;
  }

  async store(token: string, grant: Omit<McpAccessGrant, "expiresAt">): Promise<void> {
    const resource = await this.resources.forTenant(grant.tenantId);
    if (grant.resource !== resource.url) {
      throw new Error("MCP resource does not match the tenant");
    }

    const storedGrant: McpAccessGrant = {
      ...grant,
      expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000,
    };

    await this.redis.set(this.key(token), JSON.stringify(storedGrant), { EX: TOKEN_TTL_SECONDS });
  }

  async resolve(token: string, expectedResource?: string): Promise<McpToolActor | null> {
    if (!token || token.length > 256) return null;

    const serialized = await this.redis.get(this.key(token));
    if (!serialized) return null;

    let grant: McpAccessGrant;
    try {
      grant = JSON.parse(serialized) as McpAccessGrant;
    } catch {
      return null;
    }

    if (grant.expiresAt <= Date.now() || (expectedResource && grant.resource !== expectedResource))
      return null;
    const resource = await this.resources.forTenant(grant.tenantId);
    if (grant.resource !== resource.url) return null;
    if (!grant.scopes.includes("authoring")) return null;
    const email = await this.resolveIdentity(grant.userId, grant.tenantId);
    return email ? { grant, email } : null;
  }

  async resolveIdentity(userId: string, tenantId: string): Promise<string | null> {
    if (await this.revocation.isUserRevoked(userId)) return null;

    const [identity] = await this.dbAdmin
      .select({
        email: users.email,
        userId: users.id,
        tenantId: users.tenantId,
        tenantStatus: tenants.status,
        archived: users.archived,
        requiresPasswordChange: credentials.requiresPasswordChange,
      })
      .from(users)
      .innerJoin(tenants, eq(users.tenantId, tenants.id))
      .leftJoin(
        credentials,
        and(eq(credentials.userId, users.id), eq(credentials.tenantId, users.tenantId)),
      )
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId), isNull(users.deletedAt)))
      .limit(1);

    if (
      !identity ||
      identity.archived ||
      identity.requiresPasswordChange ||
      identity.tenantStatus !== TENANT_STATUSES.ACTIVE
    ) {
      return null;
    }

    return identity.email;
  }

  async revoke(token: string): Promise<void> {
    await this.redis.del(this.key(token));
  }

  private key(token: string): string {
    const digest = createHash("sha256").update(token).digest("hex");
    return `mcp:access:${digest}`;
  }
}
