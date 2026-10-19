import { type Static, Type } from "@sinclair/typebox";

export const contentMarketplaceConfigurationSchema = Type.Object({
  capabilities: Type.Object({
    contentMarketplace: Type.Object({ enabled: Type.Boolean() }),
  }),
});

export type ContentMarketplaceConfiguration = Static<typeof contentMarketplaceConfigurationSchema>;
