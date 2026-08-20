import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { setJsonbField } from "src/common/helpers/sqlHelpers";
import { DB } from "src/storage/db/db.providers";
import { resources } from "src/storage/schema";

import type { VideoMetadataResource } from "./video-metadata.types";

@Injectable()
export class VideoMetadataRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async findResource(
    resourceId: string,
    dbInstance: DatabasePg = this.db,
  ): Promise<VideoMetadataResource | undefined> {
    const [resource] = await dbInstance
      .select({ id: resources.id, reference: resources.reference, metadata: resources.metadata })
      .from(resources)
      .where(eq(resources.id, resourceId))
      .limit(1);

    return resource;
  }

  async updateDurationSeconds(
    resourceId: string,
    durationSeconds: number,
    dbInstance: DatabasePg = this.db,
  ): Promise<void> {
    await dbInstance
      .update(resources)
      .set({
        metadata: setJsonbField(resources.metadata, "durationSeconds", durationSeconds),
      })
      .where(eq(resources.id, resourceId));
  }
}
