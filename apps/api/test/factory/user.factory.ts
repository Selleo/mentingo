import { faker } from "@faker-js/faker";
import { Factory } from "fishery";

import { USER_ROLES } from "src/user/schemas/userRoles";

import hashPassword from "../../src/common/helpers/hashPassword";
import { credentials, userOnboarding, users } from "../../src/storage/schema";
import { ensureTenant } from "../helpers/tenant-helpers";

import { createSettingsFactory } from "./settings.factory";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { DatabasePg } from "src/common";

type User = InferSelectModel<typeof users>;
type Credential = InferInsertModel<typeof credentials>;
export type UserWithCredentials = User & { credentials?: Credential };

export const credentialFactory = Factory.define<Credential>(() => ({
  id: faker.string.uuid(),
  userId: faker.string.uuid(),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  password: faker.internet.password(),
  role: USER_ROLES.STUDENT,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  archived: false,
  deletedAt: null,
  tenantId: undefined as unknown as string,
}));

class UserFactory extends Factory<UserWithCredentials> {
  withCredentials(credential: { password: string }) {
    return this.associations({
      credentials: credentialFactory.build(credential),
    });
  }

  withAdminRole() {
    return this.associations({
      role: USER_ROLES.ADMIN,
    });
  }

  withAdminSettings(db: DatabasePg) {
    return this.associations({ role: USER_ROLES.ADMIN }).afterCreate(async (user) => {
      const settingsFactory = createSettingsFactory(db, user.id, true);
      await settingsFactory.create();
      return user;
    });
  }

  withUserSettings(db: DatabasePg) {
    return this.associations({ role: USER_ROLES.STUDENT }).afterCreate(async (user) => {
      const settingsFactory = createSettingsFactory(db, user.id, false);
      await settingsFactory.create();
      return user;
    });
  }

  withContentCreatorSettings(db: DatabasePg) {
    return this.associations({ role: USER_ROLES.CONTENT_CREATOR }).afterCreate(async (user) => {
      const settingsFactory = createSettingsFactory(db, user.id, false);
      await settingsFactory.create();
      return user;
    });
  }
}

export const createUserFactory = (db: DatabasePg) => {
  return UserFactory.define(({ onCreate, associations }) => {
    onCreate(async (user) => {
      const tenantId = await ensureTenant(db, user.tenantId);

      const [inserted] = await db
        .insert(users)
        .values({
          ...user,
          tenantId,
        })
        .returning();

      await db.insert(userOnboarding).values({ userId: inserted.id, tenantId });

      if (associations.credentials) {
        const [insertedCredential] = await db
          .insert(credentials)
          .values({
            ...associations.credentials,
            password: await hashPassword(associations.credentials.password),
            userId: inserted.id,
            tenantId,
          })
          .returning();

        return {
          ...inserted,
          credentials: {
            ...insertedCredential,
            password: associations.credentials.password,
          },
        };
      }

      return inserted;
    });

    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      role: USER_ROLES.STUDENT,
      archived: false,
      avatarReference: null,
      deletedAt: null,
      tenantId: faker.string.uuid(),
    };
  });
};
