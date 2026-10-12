import { isAxiosError } from "axios";

const SESSION_NOT_FOUND_MESSAGE = "courseAuthoring.errors.sessionNotFound";

/** Identifies a timeline that is no longer available to the current tenant or course access. */
export const isUnavailableAuthoringSession = (error: unknown) => {
  if (!isAxiosError(error)) return false;

  const message = error.response?.data?.message;
  const errorMessage = Array.isArray(message) ? message[0] : message;
  return error.response?.status === 404 || errorMessage === SESSION_NOT_FOUND_MESSAGE;
};
