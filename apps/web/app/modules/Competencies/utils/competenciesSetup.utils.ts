import { match } from "ts-pattern";

export const SETUP_SECTIONS = {
  CATEGORIES: "categories",
  COMPETENCIES: "competencies",
  PROFILES: "profiles",
  EXPIRY: "expiry",
} as const;

export type SetupSection = (typeof SETUP_SECTIONS)[keyof typeof SETUP_SECTIONS];

export function parseSetupSection(value: string | null): SetupSection {
  return match(value)
    .with(
      SETUP_SECTIONS.CATEGORIES,
      SETUP_SECTIONS.COMPETENCIES,
      SETUP_SECTIONS.PROFILES,
      SETUP_SECTIONS.EXPIRY,
      (section) => section,
    )
    .otherwise(() => SETUP_SECTIONS.CATEGORIES);
}
