import { SYSTEM_ROLE_SLUGS } from "./permissions";

/** Fictional people shared by the isolated tutorial seed and its recording fixture. */
export const SELF_ONBOARDING_DEMO_PEOPLE = {
  [SYSTEM_ROLE_SLUGS.ADMIN]: {
    email: "anna.kowalska@example.com",
    firstName: "Anna",
    lastName: "Kowalska",
  },
  [SYSTEM_ROLE_SLUGS.STUDENT]: {
    email: "james.wilson@example.com",
    firstName: "James",
    lastName: "Wilson",
  },
  [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR]: {
    email: "sophie.martin@example.com",
    firstName: "Sophie",
    lastName: "Martin",
  },
  [SYSTEM_ROLE_SLUGS.TRAINER]: {
    email: "daniel.nowak@example.com",
    firstName: "Daniel",
    lastName: "Nowak",
  },
} as const;
