import { faker } from "@faker-js/faker";
import { Factory } from "fishery";

import { USER_ROLES } from "src/user/schemas/userRoles";

import hashPassword from "../../src/common/helpers/hashPassword";
import { credentials, users, settings } from "../../src/storage/schema";

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
}

export const createUserFactory = (db: DatabasePg) => {
  return UserFactory.define(({ onCreate, associations }) => {
    onCreate(async (user) => {
      const [inserted] = await db.insert(users).values(user).returning();

      if (associations.credentials) {
        const [insertedCredential] = await db
          .insert(credentials)
          .values({
            ...associations.credentials,
            password: await hashPassword(associations.credentials.password),
            userId: inserted.id,
          })
          .returning();

        await db.insert(settings).values({
          userId: inserted.id,
          settings: {
            language: "en",
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        return {
          ...inserted,
          credentials: {
            ...insertedCredential,
            password: associations.credentials.password,
          },
        };
      }
      await db.insert(settings).values({
        userId: inserted.id,
        settings: {
          language: "en",
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

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
    };
  });
};
