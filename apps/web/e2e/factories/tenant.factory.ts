import { randomUUID } from "node:crypto";

import { TEST_DATA } from "../data/test-data/entity-name.data";

import type { FixtureApiClient } from "../utils/api-client";
import type {
  CreateTenantBody,
  FindAllTenantsResponse,
  FindTenantByIdResponse,
  UpdateTenantByIdBody,
} from "~/api/generated-api";

export type TenantFactoryListRecord = FindAllTenantsResponse["data"][number];
export type TenantFactoryRecord = FindTenantByIdResponse["data"];
export type TenantFactoryCreateInput = Partial<CreateTenantBody>;
export type TenantFactoryUpdateInput = UpdateTenantByIdBody;

const createTenantSlug = () => randomUUID().slice(0, 8);

const createTenantInput = (input?: TenantFactoryCreateInput): CreateTenantBody => {
  const slug = createTenantSlug();

  return {
    name: input?.name ?? `${TEST_DATA.tenant.namePrefix} ${slug}`,
    host: input?.host ?? `http://${TEST_DATA.tenant.hostPrefix}-${slug}.local`,
    status: input?.status ?? "active",
    adminEmail: input?.adminEmail ?? `${TEST_DATA.tenant.adminEmailPrefix}-${slug}@example.com`,
    adminFirstName: input?.adminFirstName ?? "Tenant",
    adminLastName: input?.adminLastName ?? "Admin",
    adminLanguage: input?.adminLanguage ?? "en",
  };
};

export class TenantFactory {
  constructor(private readonly apiClient: FixtureApiClient) {}

  async create(input?: TenantFactoryCreateInput): Promise<TenantFactoryRecord> {
    const response = await this.apiClient.api.tenantsControllerCreateTenant(
      createTenantInput(input),
    );

    return this.getById(response.data.data.id);
  }

  async createMany(
    count: number,
    build?: (index: number) => TenantFactoryCreateInput | undefined,
  ): Promise<TenantFactoryRecord[]> {
    return Promise.all(Array.from({ length: count }, (_, index) => this.create(build?.(index))));
  }

  async getById(id: string): Promise<TenantFactoryRecord> {
    const response = await this.apiClient.api.tenantsControllerFindTenantById(id);

    return response.data.data;
  }

  async findByName(name: string): Promise<TenantFactoryListRecord | null> {
    const response = await this.apiClient.api.tenantsControllerFindAllTenants({
      search: name,
      page: 1,
      perPage: 100,
    });

    return response.data.data.find((tenant) => tenant.name === name) ?? null;
  }

  async findByHost(host: string): Promise<TenantFactoryListRecord | null> {
    const response = await this.apiClient.api.tenantsControllerFindAllTenants({
      search: host,
      page: 1,
      perPage: 100,
    });

    return response.data.data.find((tenant) => tenant.host === host) ?? null;
  }

  async update(id: string, data: TenantFactoryUpdateInput): Promise<TenantFactoryRecord> {
    const response = await this.apiClient.api.tenantsControllerUpdateTenantById(id, data);

    return response.data.data;
  }

  async deactivate(id: string): Promise<TenantFactoryRecord> {
    return this.update(id, { status: "inactive" });
  }
}
