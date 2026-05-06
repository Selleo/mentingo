export const isBrowserFile = (value: unknown): value is File =>
  typeof File !== "undefined" && value instanceof File;
