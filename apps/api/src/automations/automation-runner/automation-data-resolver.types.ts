import type { UUIDType } from "src/common";

export type AutomationResolvedRecipient = {
  userId?: UUIDType;
  userEmail: string;
  tenantId: UUIDType;
  variables: Record<string, string>;
};
