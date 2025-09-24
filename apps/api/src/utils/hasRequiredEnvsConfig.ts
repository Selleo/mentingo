import * as dotenv from "dotenv";

dotenv.config({ path: "./.env" });

/**
 * Utility function to check if all required environment variables are present.
 * @param requiredEnvKeys - An array of required environment variable keys.
 * @returns boolean - true if all required environment variables are present, false otherwise.
 */
export const hasRequiredEnvsConfig = (requiredEnvKeys: string[]) => {
  return requiredEnvKeys.every((key) => process.env[key]);
};
