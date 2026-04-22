import { MailHogAPI } from "./generated-mailhog-api";

const DEFAULT_MAILHOG_BASE_URL = "http://localhost:8025";

export const createMailhogClient = (baseUrl = DEFAULT_MAILHOG_BASE_URL) => {
  return new MailHogAPI({
    baseURL: baseUrl,
    secure: false,
  });
};
