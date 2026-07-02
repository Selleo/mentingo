import { Inject, Injectable } from "@nestjs/common";
import { count, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { tenants } from "src/storage/schema";

import type {
  CountAllTenantsParams,
  CreateTenantRecord,
  FindAllTenantsParams,
  Tenant,
  TenantsListItemResponse,
  UpdateTenantRecord,
} from "./types";

@Injectable()
export class TenantsRepository {
  constructor(@Inject(DB_ADMIN) private readonly dbBase: DatabasePg) {}

  async findAll({
    page,
    perPage,
    search,
    currentTenantId,
  }: FindAllTenantsParams): Promise<TenantsListItemResponse[]> {
    const whereClause = this.buildSearchClause(search);

    const query = this.dbBase
      .select({
        ...getTableColumns(tenants),
        isCurrentTenant: sql<boolean>`${tenants.id} = ${currentTenantId}`,
      })
      .from(tenants)
      .orderBy(tenants.createdAt)
      .limit(perPage)
      .offset((page - 1) * perPage);

    if (whereClause) query.where(whereClause);

    return query;
  }

  async countAll({ search }: CountAllTenantsParams): Promise<number> {
    const whereClause = this.buildSearchClause(search);
    const query = this.dbBase.select({ totalItems: count() }).from(tenants);

    if (whereClause) query.where(whereClause);

    const [{ totalItems }] = await query;

    return totalItems;
  }

  async findById(id: string): Promise<Tenant | null> {
    const [tenant] = await this.dbBase.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    return tenant ?? null;
  }

  async findIdByHost(host: string): Promise<{ id: string } | null> {
    const [tenant] = await this.dbBase
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.host, host.toLowerCase()))
      .limit(1);

    return tenant ?? null;
  }

  async create(input: CreateTenantRecord): Promise<Tenant> {
    const [tenant] = await this.dbBase
      .insert(tenants)
      .values({
        name: input.name,
        // Lowercase — hostnames are case-insensitive and the tenant resolver
        // compares lowercased request origins against this column.
        host: input.host.toLowerCase(),
        status: input.status,
      })
      .returning();
    return tenant;
  }

  async update(id: string, updates: UpdateTenantRecord): Promise<Tenant | null> {
    const [tenant] = await this.dbBase
      .update(tenants)
      .set({
        ...updates,
        ...(updates.host && { host: updates.host.toLowerCase() }),
      })
      .where(eq(tenants.id, id))
      .returning();

    return tenant ?? null;
  }

  private buildSearchClause(search?: string) {
    if (!search) return undefined;
    const query = `%${search.toLowerCase()}%`;

    return or(ilike(tenants.name, query), ilike(tenants.host, query));
  }
}
