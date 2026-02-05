import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { TENANT_STATUSES, type TenantStatus } from "@repo/shared";
import { and, count, eq, ilike, isNull, or } from "drizzle-orm";

import { DatabasePg, type Pagination } from "src/common";
import { DEFAULT_GLOBAL_SETTINGS } from "src/settings/constants/settings.constants";
import { DB_BASE } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { settings, tenants } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";
import { UserService } from "src/user/user.service";
import { invalidateCorsCache } from "src/utils/cors";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import type { CurrentUser } from "src/common/types/current-user.type";

type CreateTenantInput = {
  name: string;
  host: string;
  status?: TenantStatus;
  adminEmail: string;
  adminFirstName?: string;
  adminLastName?: string;
  adminLanguage?: string;
};

type UpdateTenantInput = {
  name?: string;
  host?: string;
  status?: TenantStatus;
};

type TenantRow = typeof tenants.$inferSelect;

@Injectable()
export class TenantsService {
  constructor(
    @Inject(DB_BASE) private readonly dbBase: DatabasePg,
    @Inject("DB") private readonly db: DatabasePg,
    private readonly tenantRunner: TenantDbRunnerService,
    private readonly userService: UserService,
  ) {}

  async listTenants({
    page = 1,
    perPage = 20,
    search,
  }: {
    page?: number;
    perPage?: number;
    search?: string;
  }): Promise<{ data: TenantRow[]; pagination: Pagination }> {
    const conditions: Array<ReturnType<typeof and> | ReturnType<typeof or>> = [];

    if (search) {
      const query = `%${search.toLowerCase()}%`;
      conditions.push(or(ilike(tenants.name, query), ilike(tenants.host, query)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const listQuery = whereClause
      ? this.dbBase
          .select()
          .from(tenants)
          .where(whereClause)
          .orderBy(tenants.createdAt)
          .limit(perPage)
          .offset((page - 1) * perPage)
      : this.dbBase
          .select()
          .from(tenants)
          .orderBy(tenants.createdAt)
          .limit(perPage)
          .offset((page - 1) * perPage);

    const data = await listQuery;

    const countQuery = whereClause
      ? this.dbBase.select({ totalItems: count() }).from(tenants).where(whereClause)
      : this.dbBase.select({ totalItems: count() }).from(tenants);

    const [{ totalItems }] = await countQuery;

    return {
      data,
      pagination: {
        totalItems,
        page,
        perPage,
      },
    };
  }

  async createTenant(input: CreateTenantInput, actor: CurrentUser) {
    const host = this.normalizeHost(input.host);

    const [existing] = await this.dbBase
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.host, host))
      .limit(1);

    if (existing) {
      throw new ConflictException("Tenant host already exists");
    }

    const [createdTenant] = await this.dbBase
      .insert(tenants)
      .values({
        name: input.name,
        host,
        status: input.status ?? TENANT_STATUSES.ACTIVE,
      })
      .returning();

    const adminFirstName = input.adminFirstName?.trim() || "Admin";
    const adminLastName = input.adminLastName?.trim() || "User";
    const inviter = await this.userService.getUserById(actor.userId);
    const invitedByUserName = `${inviter.firstName} ${inviter.lastName}`.trim();

    await this.tenantRunner.runWithTenant(createdTenant.id, async () => {
      const [existingSettings] = await this.db
        .select({ id: settings.id })
        .from(settings)
        .where(and(eq(settings.tenantId, createdTenant.id), isNull(settings.userId)));

      if (!existingSettings) {
        await this.db.insert(settings).values({
          tenantId: createdTenant.id,
          userId: null,
          settings: settingsToJSONBuildObject(DEFAULT_GLOBAL_SETTINGS),
        });
      }

      await this.userService.createUser(
        {
          email: input.adminEmail,
          firstName: adminFirstName,
          lastName: adminLastName,
          role: USER_ROLES.ADMIN,
          language: input.adminLanguage,
        },
        this.db,
        undefined,
        {
          invite: {
            invitedByUserName,
            origin: createdTenant.host,
          },
        },
      );
    });

    await invalidateCorsCache();

    return createdTenant;
  }

  async getTenant(id: string) {
    const [tenant] = await this.dbBase.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    if (!tenant) throw new NotFoundException("Tenant not found");
    return tenant;
  }

  async updateTenant(id: string, input: UpdateTenantInput) {
    const updates: UpdateTenantInput = { ...input };

    if (updates.host) {
      updates.host = this.normalizeHost(updates.host);

      const [existing] = await this.dbBase
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.host, updates.host))
        .limit(1);

      if (existing && existing.id !== id) {
        throw new ConflictException("Tenant host already exists");
      }
    }

    const [updatedTenant] = await this.dbBase
      .update(tenants)
      .set(updates)
      .where(eq(tenants.id, id))
      .returning();

    if (!updatedTenant) {
      throw new NotFoundException("Tenant not found");
    }

    await invalidateCorsCache();

    return updatedTenant;
  }

  private normalizeHost(host: string) {
    try {
      return new URL(host).origin.replace(/\/$/, "");
    } catch {
      throw new BadRequestException("Invalid tenant host URL");
    }
  }
}
