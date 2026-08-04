import type { FixtureApiClient } from "../utils/api-client";
import type { AxiosInstance } from "axios";

export type AutomationFactoryRecord = {
  id: string;
  name: Record<string, string>;
  description: Record<string, string>;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type AutomationFactoryCreateInput = {
  name?: Record<string, string>;
  description?: Record<string, string>;
  status?: string;
};

/**
 * Factory for creating and managing automations in E2E tests.
 * Uses raw API client because the generated API methods don't accept body params
 * for automation CRUD (schema likely not yet annotated with request bodies).
 */
export class AutomationFactory {
  constructor(private readonly apiClient: FixtureApiClient) {}

  private get instance(): AxiosInstance {
    return (this.apiClient as unknown as { client: { instance: AxiosInstance } }).client.instance;
  }

  async create(input: AutomationFactoryCreateInput = {}): Promise<AutomationFactoryRecord> {
    const body = {
      name: input.name ?? { en: `E2E Automation ${Date.now()}` },
      description: input.description ?? { en: "Created by E2E test" },
      status: input.status ?? "draft",
    };

    const response = await this.instance.post("/api/automations", body);
    return response.data.data;
  }

  async getAll(): Promise<AutomationFactoryRecord[]> {
    const response = await this.instance.get("/api/automations");
    return response.data.data;
  }

  async getById(automationId: string): Promise<AutomationFactoryRecord> {
    const response = await this.instance.get(`/api/automations/${automationId}`);
    return response.data.data;
  }

  async delete(automationId: string): Promise<void> {
    await this.instance.delete(`/api/automations/${automationId}`);
  }

  async findByName(name: string, language = "en"): Promise<AutomationFactoryRecord | null> {
    const all = await this.getAll();
    return all.find((a) => a.name[language] === name) ?? null;
  }
}
