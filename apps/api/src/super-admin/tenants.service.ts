import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { TENANT_STATUSES } from "@repo/shared";
import { and, eq, isNull } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DEFAULT_GLOBAL_SETTINGS } from "src/settings/constants/settings.constants";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { settings } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";
import { UserService } from "src/user/user.service";
import { invalidateCorsCache } from "src/utils/cors";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { TenantsRepository } from "./tenants.repository";

import type { CreateTenantBody, ListTenantsQuery, Tenant, UpdateTenantBody } from "./types";
import type { PaginatedResponse } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

@Injectable()
export class TenantsService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly tenantsRepository: TenantsRepository,
    private readonly tenantRunner: TenantDbRunnerService,
    private readonly userService: UserService,
  ) {}

  async findAllTenants({
    page = 1,
    perPage = 20,
    search,
  }: ListTenantsQuery): Promise<PaginatedResponse<Tenant[]>> {
    const normalizedSearch = search?.trim() ? search.trim() : undefined;

    const [data, totalItems] = await Promise.all([
      this.tenantsRepository.findAll({
        page,
        perPage,
        search: normalizedSearch,
      }),
      this.tenantsRepository.countAll({ search: normalizedSearch }),
    ]);

    return {
      data,
      pagination: {
        totalItems,
        page,
        perPage,
      },
    };
  }

  async createTenant(input: CreateTenantBody, actor: CurrentUser) {
    const host = this.normalizeHost(input.host);

    const existing = await this.tenantsRepository.findIdByHost(host);

    if (existing) throw new ConflictException("superAdminTenants.error.hostAlreadyExists");

    const createdTenant = await this.tenantsRepository.create({
      name: input.name,
      host,
      status: input.status ?? TENANT_STATUSES.ACTIVE,
    });

    const { adminFirstName, adminLastName } = input;

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

  async findTenantById(id: string) {
    const tenant = await this.tenantsRepository.findById(id);

    if (!tenant) throw new NotFoundException("superAdminTenants.error.notFound");

    return tenant;
  }

  async updateTenantById(id: string, input: UpdateTenantBody) {
    const updates = { ...input };

    if (updates.host) {
      updates.host = this.normalizeHost(updates.host);

      const existing = await this.tenantsRepository.findIdByHost(updates.host);

      if (existing && existing.id !== id) {
        throw new ConflictException("superAdminTenants.error.hostAlreadyExists");
      }
    }

    const updatedTenant = await this.tenantsRepository.update(id, updates);

    if (!updatedTenant) throw new NotFoundException("superAdminTenants.error.notFound");

    await invalidateCorsCache();

    return updatedTenant;
  }

  private normalizeHost(host: string) {
    try {
      return new URL(host).origin.replace(/\/$/, "");
    } catch {
      throw new BadRequestException("superAdminTenants.error.invalidHost");
    }
  }
}
