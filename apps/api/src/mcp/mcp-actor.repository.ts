import { Inject, Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { users } from "src/storage/schema";

import type { McpActorAccount, McpActorIdentity } from "./mcp.types";

@Injectable()
export class McpActorRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  async findActiveAccount(actor: McpActorIdentity): Promise<McpActorAccount | undefined> {
    return this.tenantDbRunnerService.runWithTenant(actor.tenantId, async () => {
      const [account] = await this.db
        .select({ email: users.email })
        .from(users)
        .where(
          and(
            eq(users.id, actor.userId),
            eq(users.tenantId, actor.tenantId),
            eq(users.archived, false),
            sql`${users.deletedAt} IS NULL`,
          ),
        )
        .limit(1);
      return account;
    });
  }
}
