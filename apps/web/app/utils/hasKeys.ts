export const hasKeys = <T extends object>(obj: unknown, keys: readonly (keyof T)[]): obj is T => {
  return typeof obj === "object" && obj !== null && keys.every((key) => key in obj);
};
