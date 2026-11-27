import { Inject, Injectable } from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { directorySyncConnections } from "src/storage/schema";

import type { DirectorySyncConnectionStatus, DirectorySyncProvider } from "@repo/shared";

export type DirectorySyncConnection = typeof directorySyncConnections.$inferSelect;
export type DirectorySyncConnectionInsert = typeof directorySyncConnections.$inferInsert;
export type DirectorySyncConnectionUpdate = Partial<
  Omit<DirectorySyncConnectionInsert, "id" | "tenantId" | "provider" | "createdAt">
>;

@Injectable()
export class DirectorySyncConnectionRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async findConnectionByProvider(provider: DirectorySyncProvider) {
    const [connection] = await this.db
      .select()
      .from(directorySyncConnections)
      .where(eq(directorySyncConnections.provider, provider))
      .limit(1);

    return connection ?? null;
  }

  async findConnectionById(connectionId: UUIDType) {
    const [connection] = await this.db
      .select()
      .from(directorySyncConnections)
      .where(eq(directorySyncConnections.id, connectionId))
      .limit(1);

    return connection ?? null;
  }

  async findConnectionsByStatuses(statuses: DirectorySyncConnectionStatus[]) {
    if (!statuses.length) return [];

    return this.db
      .select()
      .from(directorySyncConnections)
      .where(inArray(directorySyncConnections.status, statuses));
  }

  async insertConnection(values: DirectorySyncConnectionInsert) {
    const [connection] = await this.db.insert(directorySyncConnections).values(values).returning();

    return connection;
  }

  async updateConnection(connectionId: UUIDType, values: DirectorySyncConnectionUpdate) {
    const [connection] = await this.db
      .update(directorySyncConnections)
      .set(values)
      .where(eq(directorySyncConnections.id, connectionId))
      .returning();

    return connection ?? null;
  }

  async deleteConnection(connectionId: UUIDType) {
    await this.db
      .delete(directorySyncConnections)
      .where(eq(directorySyncConnections.id, connectionId));
  }
}
