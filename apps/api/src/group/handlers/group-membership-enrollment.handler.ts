import { Injectable } from "@nestjs/common";

import { BulkAssignUsersToGroupsEvent } from "src/events";
import { GroupService } from "src/group/group.service";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import type { OutboxEventsHandlerOf } from "src/outbox/outbox.types";

@Injectable()
@OutboxEventsHandler(BulkAssignUsersToGroupsEvent)
export class GroupMembershipEnrollmentHandler
  implements OutboxEventsHandlerOf<BulkAssignUsersToGroupsEvent>
{
  constructor(
    private readonly groupService: GroupService,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {}

  async handleOutboxEvent(event: BulkAssignUsersToGroupsEvent) {
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
