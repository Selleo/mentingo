import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { CreateCategoryEvent, DeleteCategoryEvent, UpdateCategoryEvent } from "src/events";

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";
import { buildActivityLogMetadata } from "../utils/build-activity-log-metadata";

type CategoryEventType = CreateCategoryEvent | UpdateCategoryEvent | DeleteCategoryEvent;

const CategoryActivityEvents = [
  CreateCategoryEvent,
  UpdateCategoryEvent,
  DeleteCategoryEvent,
] as const;

@Injectable()
@EventsHandler(...CategoryActivityEvents)
export class CategoryActivityHandler implements IEventHandler<CategoryEventType> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handle(event: CategoryEventType) {
    if (event instanceof CreateCategoryEvent) return await this.handleCreate(event);
    if (event instanceof UpdateCategoryEvent) return await this.handleUpdate(event);
    if (event instanceof DeleteCategoryEvent) return await this.handleDelete(event);
  }

  private async handleCreate(event: CreateCategoryEvent) {
    const metadata = buildActivityLogMetadata({
      previous: {},
      updated: event.categoryData.category,
      schema: "create",
    });

    await this.activityLogsService.recordActivity({
      actor: event.categoryData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.CREATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.CATEGORY,
      resourceId: event.categoryData.categoryId,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleUpdate(event: UpdateCategoryEvent) {
    const metadata = buildActivityLogMetadata({
      previous: event.categoryUpdateData.previousCategoryData,
      updated: event.categoryUpdateData.updatedCategoryData,
    });

    await this.activityLogsService.recordActivity({
      actor: event.categoryUpdateData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.CATEGORY,
      resourceId: event.categoryUpdateData.categoryId,
      changedFields: metadata.changedFields,
      before: metadata.before,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleDelete(event: DeleteCategoryEvent) {
    await this.activityLogsService.recordActivity({
      actor: event.deleteCategoryData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.DELETE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.CATEGORY,
      resourceId: event.deleteCategoryData.categoryId,
      context: event.deleteCategoryData.categoryTitle
        ? { categoryName: event.deleteCategoryData.categoryTitle }
        : null,
    });
  }
}
