import { UUIDType } from "src/common";

import type { CONTENT_MARKETPLACE_COPY_STATUSES } from "../content-marketplace.constants";

/** A marketplace copy that ended before its import could report it, such as a failed archive download. */
export class ContentMarketplaceCourseCopiedEvent {
  constructor(
    public readonly tenantId: UUIDType,
    public readonly acquisitionId: UUIDType,
    public readonly status: (typeof CONTENT_MARKETPLACE_COPY_STATUSES)[keyof typeof CONTENT_MARKETPLACE_COPY_STATUSES],
    public readonly courseId: UUIDType | null,
    public readonly occurredAt: string,
  ) {}
}
