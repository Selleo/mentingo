import { faker } from "@faker-js/faker";
import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import type { UsersSeed } from "./seed.types";

export const students: UsersSeed = [
  {
    roleSlug: SYSTEM_ROLE_SLUGS.STUDENT,
    email: "student@example.com",
    firstName: faker.person.firstName(),
    lastName: "Student",
  },
  {
    roleSlug: SYSTEM_ROLE_SLUGS.STUDENT,
    email: "student2@example.com",
    firstName: faker.person.firstName(),
    lastName: "Student",
  },
];

export const admin: UsersSeed = [
  {
    roleSlug: SYSTEM_ROLE_SLUGS.ADMIN,
    email: "admin@example.com",
    firstName: faker.person.firstName(),
    lastName: "Admin",
  },
];

export const contentCreators: UsersSeed = [
  {
    roleSlug: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
    email: "contentcreator@example.com",
    firstName: faker.person.firstName(),
    lastName: "Content Creator",
  },
  {
    roleSlug: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
    email: "contentcreator2@example.com",
    firstName: faker.person.firstName(),
    lastName: "Content Creator 2",
  },
];
