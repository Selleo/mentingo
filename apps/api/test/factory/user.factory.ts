import { faker } from "@faker-js/faker";
import { SYSTEM_ROLE_SLUGS, type SystemRoleSlug } from "@repo/shared";
import { Factory } from "fishery";

import hashPassword from "../../src/common/helpers/hashPassword";
import { credentials, userOnboarding, users } from "../../src/storage/schema";
import { assignSystemRoleToUserInTests } from "../helpers/permission-role-helpers";
import { ensureTenant } from "../helpers/tenant-helpers";

import { createSettingsFactory } from "./settings.factory";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { DatabasePg } from "src/common";

type User = InferSelectModel<typeof users>;
type Credential = InferInsertModel<typeof credentials>;
export type UserWithCredentials = User & { credentials?: Credential };
type UserFactoryAttributes = UserWithCredentials & { roleSlug?: SystemRoleSlug; role?: string };

const mapRoleToRoleSlug = (role?: string): SystemRoleSlug => {
  switch (role) {
    case "admin":
      return SYSTEM_ROLE_SLUGS.ADMIN;
    case "content_creator":
      return SYSTEM_ROLE_SLUGS.CONTENT_CREATOR;
    default:
      return SYSTEM_ROLE_SLUGS.STUDENT;
  }
};

export const credentialFactory = Factory.define<Credential>(() => ({
  id: faker.string.uuid(),
  userId: faker.string.uuid(),
  password: faker.internet.password(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  tenantId: undefined as unknown as string,
}));

class UserFactory extends Factory<UserFactoryAttributes> {
  withCredentials(credential: { password: string }) {
    return this.associations({
      credentials: credentialFactory.build(credential),
    });
  }

  withAdminRole() {
    return this.associations({
      roleSlug: SYSTEM_ROLE_SLUGS.ADMIN,
    });
  }

  withAdminSettings(db: DatabasePg) {
    return this.associations({ roleSlug: SYSTEM_ROLE_SLUGS.ADMIN }).afterCreate(async (user) => {
      const settingsFactory = createSettingsFactory(db, user.id, true);
      await settingsFactory.create();
      return user;
    });
  }

  withUserSettings(db: DatabasePg) {
    return this.associations({ roleSlug: SYSTEM_ROLE_SLUGS.STUDENT }).afterCreate(async (user) => {
      const settingsFactory = createSettingsFactory(db, user.id, false);
      await settingsFactory.create();
      return user;
    });
  }

  withContentCreatorSettings(db: DatabasePg) {
    return this.associations({ roleSlug: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR }).afterCreate(
      async (user) => {
        const settingsFactory = createSettingsFactory(db, user.id, false);
        await settingsFactory.create();
        return user;
      },
    );
  }
}

export const createUserFactory = (db: DatabasePg) => {
  return UserFactory.define(({ onCreate, associations, transientParams }) => {
    onCreate(async (user) => {
      const tenantId = await ensureTenant(db, user.tenantId);
      const associatedRoleSlug = associations.roleSlug as SystemRoleSlug | undefined;
      const roleSlug =
        user.roleSlug ??
        associatedRoleSlug ??
        mapRoleToRoleSlug(user.role) ??
        (transientParams.roleSlug as SystemRoleSlug | undefined) ??
        SYSTEM_ROLE_SLUGS.STUDENT;

      const [inserted] = await db
        .insert(users)
        .values({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          archived: user.archived,
          avatarReference: user.avatarReference,
          deletedAt: user.deletedAt,
          tenantId,
        })
        .returning();

      await db.insert(userOnboarding).values({ userId: inserted.id, tenantId });
      await assignSystemRoleToUserInTests(db, inserted.id, tenantId, roleSlug);

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
      roleSlug: SYSTEM_ROLE_SLUGS.STUDENT,
      archived: false,
      avatarReference: null,
      deletedAt: null,
      tenantId: faker.string.uuid(),
    };
  });
};
