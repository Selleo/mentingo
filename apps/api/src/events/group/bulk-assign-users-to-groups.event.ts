import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";
import type {
  BulkAssignUsersToGroupsSource,
  UserGroupMembershipUpdate,
} from "src/group/types/group-membership-assignment.types";

export type BulkAssignUsersToGroupsUpdate = UserGroupMembershipUpdate;

type BulkAssignUsersToGroupsData = {
  actor: ActorUserType;
  tenantId: UUIDType;
  source: BulkAssignUsersToGroupsSource;
  requestedCount: number;
  updatedCount: number;
  skippedCount: number;
  updates: BulkAssignUsersToGroupsUpdate[];
};

export class BulkAssignUsersToGroupsEvent {
  constructor(public readonly bulkAssignUsersToGroupsData: BulkAssignUsersToGroupsData) {}
}
