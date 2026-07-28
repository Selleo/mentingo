import type { UUIDType } from "src/common";

/**
 * Flat key-value map matching the `providedVariables` keys defined in
 * `packages/shared/src/constants/automations.ts`.
 *
 * Each resolver method returns an array of these (one per recipient).
 */
export type AutomationResolvedRecipient = {
  /** Recipient user ID — used for resolving per-user settings (e.g. language) */
  userId?: UUIDType;
  /** Recipient email — used as the `to` address */
  userEmail: string;
  /** Tenant scope for branding / origin resolution */
  tenantId: UUIDType;
  /** All template variables as flat key→string pairs */
  variables: Record<string, string>;
};
