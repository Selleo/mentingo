import { faker } from "@faker-js/faker";
import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import type { UsersSeed } from "./seed.types";

const buildStudent = (email: string): UsersSeed[number] => ({
  roleSlug: SYSTEM_ROLE_SLUGS.STUDENT,
  email,
  firstName: faker.person.firstName(),
  lastName: "Student",
});

export const students: UsersSeed = [
  buildStudent("student@example.com"),
  buildStudent("student0@example.com"),
  buildStudent("student2@example.com"),
  buildStudent("student3@example.com"),
  buildStudent("student4@example.com"),
  buildStudent("student5@example.com"),
  buildStudent("student6@example.com"),
  buildStudent("student7@example.com"),
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
