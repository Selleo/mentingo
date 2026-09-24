import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { resources } from "src/storage/schema";

@Injectable()
export class EmailTemplateAssetRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async findEmailTemplateAsset(id: UUIDType, tenantId: UUIDType) {
    const [resource] = await this.db
      .select()
      .from(resources)
      .where(and(eq(resources.id, id), eq(resources.tenantId, tenantId)));

    return resource;
  }
}
