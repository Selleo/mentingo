import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { BulkAssignUsersToGroupsEvent } from "src/events";
import { GroupService } from "src/group/group.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

@Injectable()
@EventsHandler(BulkAssignUsersToGroupsEvent)
export class GroupMembershipEnrollmentHandler
  implements IEventHandler<BulkAssignUsersToGroupsEvent>
{
  constructor(
    private readonly groupService: GroupService,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {}

  async handle(event: BulkAssignUsersToGroupsEvent) {
    if (event instanceof BulkAssignUsersToGroupsEvent) {
      return this.handleBulkAssignUsersToGroups(event);
    }
  }

  private async handleBulkAssignUsersToGroups(event: BulkAssignUsersToGroupsEvent) {
    const { tenantId, updates } = event.bulkAssignUsersToGroupsData;

    await this.tenantRunner.runWithTenant(tenantId, async () => {
      await this.groupService.syncUserGroupMembershipEnrollments(updates);
    });
  }
}
