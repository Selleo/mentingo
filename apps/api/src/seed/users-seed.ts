import { faker } from "@faker-js/faker";

import { USER_ROLES } from "src/user/schemas/userRoles";

import type { UsersSeed } from "./seed.types";

export const students: UsersSeed = [
  {
    role: USER_ROLES.STUDENT,
    email: "student@example.com",
    firstName: faker.person.firstName(),
    lastName: "Student",
  },
  {
    role: USER_ROLES.STUDENT,
    email: "student2@example.com",
    firstName: faker.person.firstName(),
    lastName: "Student",
  },
];

export const admin: UsersSeed = [
  {
    role: USER_ROLES.ADMIN,
    email: "admin@example.com",
    firstName: faker.person.firstName(),
    lastName: "Admin",
  },
];

export const contentCreators: UsersSeed = [
  {
    role: USER_ROLES.CONTENT_CREATOR,
    email: "contentcreator@example.com",
    firstName: faker.person.firstName(),
    lastName: "Content Creator",
  },
  {
    role: USER_ROLES.CONTENT_CREATOR,
    email: "contentcreator2@example.com",
    firstName: faker.person.firstName(),
    lastName: "Content Creator 2",
  },
];
