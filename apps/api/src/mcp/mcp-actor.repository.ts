import { Inject, Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { users } from "src/storage/schema";

import type { McpActorAccount } from "./mcp.types";

@Injectable()
export class McpActorRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async findActiveAccount(userId: UUIDType): Promise<McpActorAccount | undefined> {
    const [account] = await this.db
      .select({ email: users.email })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.archived, false), sql`${users.deletedAt} IS NULL`))
      .limit(1);
    return account;
  }
}
