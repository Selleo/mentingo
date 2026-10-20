export const KEY_KINDS = {
  MANAGING: "managing",
  NOT_MANAGING: "not managing",
} as const;

export type KeyKind = (typeof KEY_KINDS)[keyof typeof KEY_KINDS];

export const CATALOG_ACCESS_CASES: Array<{ keyKind: KeyKind; status: number }> = [
  { keyKind: KEY_KINDS.MANAGING, status: 200 },
  { keyKind: KEY_KINDS.NOT_MANAGING, status: 403 },
];

export const CATALOG_COURSES = {
  ALGEBRA: { title: "Algebra Basics", thumbnailS3Key: "https://cdn.example.test/algebra.png" },
  BIOLOGY: { title: "Biology for Beginners", thumbnailS3Key: null },
  CHEMISTRY: { title: "Chemistry Lab", thumbnailS3Key: null },
} as const;

export const CATALOG_CATEGORY_TITLE = "Mathematics";

export const KEYWORD_SEARCH_CASES = [
  { keyword: "algebra", titles: [CATALOG_COURSES.ALGEBRA.title] },
  { keyword: "  BIO ", titles: [CATALOG_COURSES.BIOLOGY.title] },
  { keyword: "for", titles: [CATALOG_COURSES.BIOLOGY.title] },
  { keyword: "astronomy", titles: [] },
];

export const POLISH_TITLE = "Podstawy algebry";
