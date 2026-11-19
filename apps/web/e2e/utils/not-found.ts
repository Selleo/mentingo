import { isAxiosError } from "axios";

/** Resolves to null when the API answers 404; any other failure is rethrown. */
export const nullIfNotFound = async <T>(request: Promise<T>): Promise<T | null> => {
  try {
    return await request;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
};
