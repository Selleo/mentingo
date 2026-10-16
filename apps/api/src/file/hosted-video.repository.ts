import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { hostedVideos } from "src/storage/schema";

import { HOSTED_VIDEO_STATUSES } from "./hosted-video.constants";

import type { HostedVideoCopyIdentity, HostedVideoStatus } from "./hosted-video.types";
import type { VideoProviderType } from "@repo/shared";
import type { UUIDType } from "src/common";

const UNFINISHED_HOSTED_VIDEO_STATUSES = [
  HOSTED_VIDEO_STATUSES.UPLOADING,
  HOSTED_VIDEO_STATUSES.PROCESSING,
];

/**
 * Stores every video the platform created at an external streaming provider. Rows span tenants
 * (webhooks and copies are routed before a tenant is known), so they use the admin handle.
 */
@Injectable()
export class HostedVideoRepository {
  constructor(@Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg) {}

  async findCopy(identity: HostedVideoCopyIdentity) {
    const [copy] = await this.dbAdmin
      .select()
      .from(hostedVideos)
      .where(
        and(
          eq(hostedVideos.tenantId, identity.tenantId),
          eq(hostedVideos.provider, identity.provider),
          eq(hostedVideos.providerConfigurationSignature, identity.providerConfigurationSignature),
          eq(hostedVideos.copiedFromTenantId, identity.copiedFromTenantId),
          eq(hostedVideos.copiedFromReference, identity.copiedFromReference),
        ),
      )
      .limit(1);

    return copy;
  }

  async findByProviderVideoId(provider: VideoProviderType, providerVideoId: string) {
    const [hostedVideo] = await this.dbAdmin
      .select()
      .from(hostedVideos)
      .where(
        and(eq(hostedVideos.provider, provider), eq(hostedVideos.providerVideoId, providerVideoId)),
      )
      .limit(1);

    return hostedVideo;
  }

  async findStatusesByReferences(tenantId: UUIDType, references: string[]) {
    if (!references.length) return [];

    return this.dbAdmin
      .select({ reference: hostedVideos.reference, status: hostedVideos.status })
      .from(hostedVideos)
      .where(and(eq(hostedVideos.tenantId, tenantId), inArray(hostedVideos.reference, references)));
  }

  async insertUploadingCopyIfMissing(identity: HostedVideoCopyIdentity) {
    const [copy] = await this.dbAdmin
      .insert(hostedVideos)
      .values({ ...identity, status: HOSTED_VIDEO_STATUSES.UPLOADING })
      .onConflictDoNothing()
      .returning();

    return copy;
  }

  /**
   * Claims a failed copy for another upload and detaches its broken provider video, so no
   * concurrent transfer reuses that reference while the copy uploads again.
   */
  async reclaimFailedCopy(id: UUIDType) {
    return this.dbAdmin.transaction(async (trx) => {
      const [failedCopy] = await trx
        .select({ providerVideoId: hostedVideos.providerVideoId })
        .from(hostedVideos)
        .where(and(eq(hostedVideos.id, id), eq(hostedVideos.status, HOSTED_VIDEO_STATUSES.FAILED)))
        .for("update");

      if (!failedCopy) return undefined;

      const [copy] = await trx
        .update(hostedVideos)
        .set({
          status: HOSTED_VIDEO_STATUSES.UPLOADING,
          statusChangedAt: sql`now()`,
          providerVideoId: null,
          reference: null,
        })
        .where(eq(hostedVideos.id, id))
        .returning();

      return { copy, detachedProviderVideoId: failedCopy.providerVideoId };
    });
  }

  async recordCreatedVideo(id: UUIDType, providerVideoId: string, reference: string) {
    await this.dbAdmin
      .update(hostedVideos)
      .set({ providerVideoId, reference })
      .where(eq(hostedVideos.id, id));
  }

  async updateStatus(id: UUIDType, status: HostedVideoStatus) {
    await this.dbAdmin
      .update(hostedVideos)
      .set({
        status,
        statusChangedAt: sql`CASE WHEN ${hostedVideos.status} = ${status} THEN ${hostedVideos.statusChangedAt} ELSE now() END`,
      })
      .where(eq(hostedVideos.id, id));
  }

  /** Settles an upload only while it is still uploading, so a live worker's result is never overwritten. */
  async settleUploadingCopy(
    id: UUIDType,
    settlement: { status: HostedVideoStatus; providerVideoId?: string; reference?: string },
  ) {
    const [settled] = await this.dbAdmin
      .update(hostedVideos)
      .set({ ...settlement, statusChangedAt: sql`now()` })
      .where(and(eq(hostedVideos.id, id), eq(hostedVideos.status, HOSTED_VIDEO_STATUSES.UPLOADING)))
      .returning({ id: hostedVideos.id });

    return settled;
  }

  /** Marks unfinished videos not checked since the cutoff as checked and returns them. */
  async claimUnfinishedVideosForStatusCheck(checkedBefore: Date, limit: number) {
    const unfinishedVideoIds = this.dbAdmin
      .select({ id: hostedVideos.id })
      .from(hostedVideos)
      .where(
        and(
          inArray(hostedVideos.status, UNFINISHED_HOSTED_VIDEO_STATUSES),
          or(
            isNull(hostedVideos.lastCheckedAt),
            lt(hostedVideos.lastCheckedAt, checkedBefore.toISOString()),
          ),
        ),
      )
      .orderBy(sql`${hostedVideos.lastCheckedAt} ASC NULLS FIRST`)
      .limit(limit)
      .for("update", { skipLocked: true });

    return this.dbAdmin
      .update(hostedVideos)
      .set({ lastCheckedAt: sql`now()` })
      .where(inArray(hostedVideos.id, unfinishedVideoIds))
      .returning();
  }
}
