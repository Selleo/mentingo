import type { DirectorySyncProvider } from "@repo/shared";

/** The account ID the sign-in provider verified, matching the ID directory sync stores. */
export type ProviderLoginIdentity = {
  provider: DirectorySyncProvider;
  externalId: string;
};

export type ProviderLoginUserType = {
  email: string;
  firstName: string;
  lastName: string;
  identity?: ProviderLoginIdentity;
};
