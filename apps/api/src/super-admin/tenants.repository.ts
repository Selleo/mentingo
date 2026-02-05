import { Inject, Injectable } from "@nestjs/common";
import { count, eq, ilike, or } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB_BASE } from "src/storage/db/db.providers";
import { tenants } from "src/storage/schema";

import type {
  CountAllTenantsParams,
  CreateTenantRecord,
  FindAllTenantsParams,
  Tenant,
  UpdateTenantRecord,
} from "./types";

@Injectable()
export class TenantsRepository {
  constructor(@Inject(DB_BASE) private readonly dbBase: DatabasePg) {}

  async findAll({ page, perPage, search }: FindAllTenantsParams): Promise<Tenant[]> {
    const whereClause = this.buildSearchClause(search);

    const query = this.dbBase
      .select()
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
      .where(eq(tenants.host, host))
      .limit(1);

    return tenant ?? null;
  }

  async create(input: CreateTenantRecord): Promise<Tenant> {
    const [tenant] = await this.dbBase
      .insert(tenants)
      .values({
        name: input.name,
        host: input.host,
        status: input.status,
      })
      .returning();
    return tenant;
  }

  async update(id: string, updates: UpdateTenantRecord): Promise<Tenant | null> {
    const [tenant] = await this.dbBase
      .update(tenants)
      .set(updates)
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
