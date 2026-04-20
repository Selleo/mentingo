import { randomUUID } from "node:crypto";

import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { TEST_DATA } from "../data/test-data/entity-name.data";

import type { FixtureApiClient } from "../utils/api-client";
import type {
  AdminUpdateUserBody,
  CreateUserBody,
  GetUserByIdResponse,
  RegisterBody,
} from "~/api/generated-api";

export type UserFactoryRecord = GetUserByIdResponse["data"];
export type UserFactoryCreateInput = Partial<CreateUserBody>;
export type UserFactoryUpdateInput = AdminUpdateUserBody;
export type UserFactoryRegisterInput = Partial<
  Pick<RegisterBody, "email" | "firstName" | "lastName" | "language">
> & {
  password?: string;
};

const createUserDefaults = (): CreateUserBody => {
  const suffix = randomUUID().slice(0, 8);

  return {
    firstName: `${TEST_DATA.user.firstNamePrefix} ${suffix}`,
    lastName: TEST_DATA.user.lastNamePrefix,
    email: `${TEST_DATA.user.emailPrefix}-${suffix}@example.com`,
    roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
    language: "en",
  };
};

export class UserFactory {
  constructor(private readonly apiClient: FixtureApiClient) {}

  async register(input: UserFactoryRegisterInput = {}): Promise<UserFactoryRecord> {
    const defaults = createUserDefaults();
    const password = input.password ?? "Password123@";
    const language: RegisterBody["language"] = input.language ?? "en";

    const response = await this.apiClient.api.authControllerRegister({
      email: input.email ?? defaults.email,
      firstName: input.firstName ?? defaults.firstName,
      lastName: input.lastName ?? defaults.lastName,
      language,
      password,
    });

    return this.getById(response.data.data.id);
  }

  async create(input: UserFactoryCreateInput = {}): Promise<UserFactoryRecord> {
    const response = await this.apiClient.api.userControllerCreateUser({
      ...createUserDefaults(),
      ...input,
    });

    return this.getById(response.data.data.id);
  }

  async createMany(
    count: number,
    buildInput?: (index: number) => UserFactoryCreateInput,
  ): Promise<UserFactoryRecord[]> {
    const users: UserFactoryRecord[] = [];

    for (let index = 0; index < count; index++) {
      users.push(await this.create(buildInput?.(index) ?? {}));
    }

    return users;
  }

  async getById(id: string): Promise<UserFactoryRecord> {
    const response = await this.apiClient.api.userControllerGetUserById({ id });

    return response.data.data;
  }

  async getByEmail(email: string): Promise<UserFactoryRecord | null> {
    const response = await this.apiClient.api.userControllerGetUsers({
      keyword: email,
      perPage: 100,
      sort: "email",
    });

    return response.data.data.find((user) => user.email === email) ?? null;
  }

  async update(id: string, data: UserFactoryUpdateInput): Promise<UserFactoryRecord> {
    await this.apiClient.api.userControllerAdminUpdateUser({ id }, data);

    return this.getById(id);
  }

  async delete(id: string): Promise<void> {
    const existingUser = await this.safeGetById(id);

    if (!existingUser) return;

    await this.apiClient.api.userControllerAdminUpdateUser(
      { id },
      {
        archived: false,
        roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
        groups: [],
      },
    );

    await this.apiClient.api.userControllerDeleteBulkUsers({ userIds: [id] });
  }

  async deleteMany(ids: string[]): Promise<void> {
    const existingUsers = await Promise.all(ids.map((id) => this.safeGetById(id)));
    const existingIds = existingUsers.filter((user): user is UserFactoryRecord => Boolean(user));

    if (!existingIds.length) return;

    await Promise.all(
      existingIds.map((user) =>
        this.apiClient.api.userControllerAdminUpdateUser(
          { id: user.id },
          {
            archived: false,
            roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
            groups: [],
          },
        ),
      ),
    );

    await this.apiClient.api.userControllerDeleteBulkUsers({
      userIds: existingIds.map((user) => user.id),
    });
  }

  private async safeGetById(id: string): Promise<UserFactoryRecord | null> {
    try {
      return await this.getById(id);
    } catch {
      return null;
    }
  }
}
