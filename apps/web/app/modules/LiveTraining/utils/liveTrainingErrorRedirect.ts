import { isAxiosError } from "axios";

export function getLiveTrainingErrorRedirect(error: unknown): "/" | "/calendar" | null {
  if (!isAxiosError(error)) return "/calendar";
  if (error.response?.status === 403) return "/";
  if (error.response?.status === 400 || error.response?.status === 404) return "/calendar";
  return null;
}
