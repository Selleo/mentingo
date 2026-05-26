import type { SupportedLanguages } from "@repo/shared";
import type { Static } from "@sinclair/typebox";
import type {
  allGroupsSchema,
  createGroupSchema,
  groupBaseLanguageUpdateSchema,
  GroupKeywordFilterBody,
  groupSchema,
  groupsFilterSchema,
  groupSortFieldsOptions,
  updateGroupSchema,
} from "src/group/group.schema";

export type GroupResponse = Static<typeof groupSchema>;
export type AllGroupsResponse = Static<typeof allGroupsSchema>;
export type GroupBaseLanguageUpdateBody = Static<typeof groupBaseLanguageUpdateSchema>;

export type GroupsFilterSchema = Static<typeof groupsFilterSchema>;
export type GroupSortFieldsOptions = Static<typeof groupSortFieldsOptions>;

export type GroupsQuery = {
  filters?: GroupKeywordFilterBody;
  page?: number;
  perPage?: number;
  sort?: GroupSortFieldsOptions;
  language?: SupportedLanguages;
};

export type CreateGroupBody = Static<typeof createGroupSchema>;
export type UpdateGroupBody = Static<typeof updateGroupSchema>;

export type GroupCourseSettings = {
  isMandatory: boolean;
  dueDate?: Date | null;
};
