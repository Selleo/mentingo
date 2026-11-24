import { match } from "ts-pattern";

export const SETUP_SECTIONS = {
  CATEGORIES: "categories",
  COMPETENCIES: "competencies",
  TRACKS: "tracks",
  EXPIRY: "expiry",
} as const;

export type SetupSection = (typeof SETUP_SECTIONS)[keyof typeof SETUP_SECTIONS];

export function parseSetupSection(value: string | null): SetupSection {
  return match(value)
    .with(
      SETUP_SECTIONS.CATEGORIES,
      SETUP_SECTIONS.COMPETENCIES,
      SETUP_SECTIONS.TRACKS,
      SETUP_SECTIONS.EXPIRY,
      (section) => section,
    )
    .otherwise(() => SETUP_SECTIONS.CATEGORIES);
}
