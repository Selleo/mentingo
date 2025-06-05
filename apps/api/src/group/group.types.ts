import type { Static } from "@sinclair/typebox";
import type {
  allGroupsSchema,
  baseGroupSchema,
  groupSchema,
  groupsFilterSchema,
  groupSortFieldsOptions,
} from "src/group/group.schema";

export type GroupResponse = Static<typeof groupSchema>;
export type AllGroupsResponse = Static<typeof allGroupsSchema>;

export type GroupsFilterSchema = Static<typeof groupsFilterSchema>;
export type GroupSortFieldsOptions = Static<typeof groupSortFieldsOptions>;

export type GroupsQuery = {
  filters?: GroupsFilterSchema;
  page?: number;
  perPage?: number;
  sort?: GroupSortFieldsOptions;
};

export type UpsertGroupBody = Static<typeof baseGroupSchema>;
