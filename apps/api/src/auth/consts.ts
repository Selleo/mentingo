export const ACCESS_TOKEN_EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 24 hours
export const REFRESH_TOKEN_EXPIRATION_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const REFRESH_TOKEN_EXPIRATION_TIME = REFRESH_TOKEN_EXPIRATION_SECONDS * 1000;
export const CORS_ORIGIN = process.env.CORS_ORIGIN || "https://app.lms.localhost";
export const MAGIC_LINK_EXPIRATION_TIME = 15 * 60 * 1000; // 15 minutes
