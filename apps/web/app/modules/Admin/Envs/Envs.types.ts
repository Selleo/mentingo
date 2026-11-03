import type { ENV_GROUPS, ENV_STATUS, SECRET_METADATA } from "./Envs.constants";

export type SecretKey = keyof typeof SECRET_METADATA;
export type FormValues = Partial<Record<SecretKey, string>>;
export type EnvGroup = (typeof ENV_GROUPS)[number];
export type EnvStatus = Exclude<
  (typeof ENV_STATUS)[keyof typeof ENV_STATUS],
  typeof ENV_STATUS.ALL
>;
