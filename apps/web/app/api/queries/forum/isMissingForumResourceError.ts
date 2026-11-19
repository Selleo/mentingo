import { isAxiosError } from "axios";

const MISSING_RESOURCE_STATUSES = [400, 404];

export const isMissingForumResourceError = (error: unknown) => {
  const status = isAxiosError(error) ? error.response?.status : undefined;

  return status !== undefined && MISSING_RESOURCE_STATUSES.includes(status);
};
