import { ACTIVITY_LOG_RESOURCE_TYPES, type ActivityLogResourceType } from "@repo/shared";

import { ActivityLogResourceNameService } from "./activity-log-resource-name.service";

import type { DatabasePg, UUIDType } from "src/common";
import type { LocalizationService } from "src/localization/localization.service";

describe("ActivityLogResourceNameService", () => {
  it("deduplicates IDs and resolves each resource type in one batch", async () => {
    const service = new ActivityLogResourceNameService({} as DatabasePg, {} as LocalizationService);
    const fetchResourceNamesByType = jest
      .spyOn(service as unknown as ResourceNameFetcher, "fetchResourceNamesByType")
      .mockImplementation(async (resourceType, ids) =>
        ids.map((id) => ({ id, name: `${resourceType} name` })),
      );

    const names = await service.resolveCurrentResourceNames([
      { resourceType: ACTIVITY_LOG_RESOURCE_TYPES.COURSE, resourceId: "course-id" },
      { resourceType: ACTIVITY_LOG_RESOURCE_TYPES.COURSE, resourceId: "course-id" },
      { resourceType: ACTIVITY_LOG_RESOURCE_TYPES.GROUP, resourceId: "group-id" },
    ]);

    expect(fetchResourceNamesByType).toHaveBeenCalledTimes(2);
    expect(fetchResourceNamesByType).toHaveBeenCalledWith(ACTIVITY_LOG_RESOURCE_TYPES.COURSE, [
      "course-id",
    ]);
    expect(fetchResourceNamesByType).toHaveBeenCalledWith(ACTIVITY_LOG_RESOURCE_TYPES.GROUP, [
      "group-id",
    ]);
    expect(names).toEqual(
      new Map([
        [`${ACTIVITY_LOG_RESOURCE_TYPES.COURSE}:course-id`, "course name"],
        [`${ACTIVITY_LOG_RESOURCE_TYPES.GROUP}:group-id`, "group name"],
      ]),
    );
  });
});

type ResourceNameFetcher = {
  fetchResourceNamesByType: (
    resourceType: ActivityLogResourceType,
    ids: UUIDType[],
  ) => Promise<Array<{ id: string; name: string }>>;
};
