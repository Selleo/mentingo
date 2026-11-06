import { faker } from "@faker-js/faker";
import { SELF_ONBOARDING_DEMO_PEOPLE, SYSTEM_ROLE_SLUGS } from "@repo/shared";

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

export const trainers: UsersSeed = [
  {
    roleSlug: SYSTEM_ROLE_SLUGS.TRAINER,
    email: "trainer@example.com",
    firstName: faker.person.firstName(),
    lastName: "Trainer",
  },
  {
    roleSlug: SYSTEM_ROLE_SLUGS.TRAINER,
    email: "trainer2@example.com",
    firstName: faker.person.firstName(),
    lastName: "Trainer 2",
  },
];

if (process.env.SELF_ONBOARDING_DEMO === "1") {
  students.splice(
    0,
    students.length,
    {
      ...SELF_ONBOARDING_DEMO_PEOPLE[SYSTEM_ROLE_SLUGS.STUDENT],
      roleSlug: SYSTEM_ROLE_SLUGS.STUDENT,
    },
    {
      email: "emma.thompson@example.com",
      firstName: "Emma",
      lastName: "Thompson",
      roleSlug: SYSTEM_ROLE_SLUGS.STUDENT,
    },
    {
      email: "mateusz.zielinski@example.com",
      firstName: "Mateusz",
      lastName: "Zielinski",
      roleSlug: SYSTEM_ROLE_SLUGS.STUDENT,
    },
  );
  admin.splice(0, admin.length, {
    ...SELF_ONBOARDING_DEMO_PEOPLE[SYSTEM_ROLE_SLUGS.ADMIN],
    roleSlug: SYSTEM_ROLE_SLUGS.ADMIN,
  });
  contentCreators.splice(0, contentCreators.length, {
    ...SELF_ONBOARDING_DEMO_PEOPLE[SYSTEM_ROLE_SLUGS.CONTENT_CREATOR],
    roleSlug: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
  });
  trainers.splice(0, trainers.length, {
    ...SELF_ONBOARDING_DEMO_PEOPLE[SYSTEM_ROLE_SLUGS.TRAINER],
    roleSlug: SYSTEM_ROLE_SLUGS.TRAINER,
  });
}
