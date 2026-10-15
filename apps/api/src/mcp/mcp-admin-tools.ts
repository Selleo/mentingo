import { BadRequestException } from "@nestjs/common";
import { PERMISSIONS, type PermissionKey } from "@repo/shared";

import * as Schemas from "./mcp-admin-tool.schemas";
import { asMcpInputSchema } from "./mcp-tool.schema";

import type { McpToolRunner } from "./mcp-tool-runner.types";
import type { McpUploadGrantService } from "./mcp-upload-grant.service";
import type { McpServer } from "@modelcontextprotocol/server";
import type { GroupService } from "src/group/group.service";
import type { UserService } from "src/user/user.service";

export const MCP_ADMIN_TOOL_PERMISSIONS = {
  get_my_user: [PERMISSIONS.ACCOUNT_READ_SELF],
  get_my_user_details: [PERMISSIONS.USER_READ_SELF],
  update_my_user: [PERMISSIONS.ACCOUNT_UPDATE_SELF],
  request_my_avatar_upload: [PERMISSIONS.ACCOUNT_UPDATE_SELF],
  remove_my_avatar: [PERMISSIONS.ACCOUNT_UPDATE_SELF],
  list_users: [PERMISSIONS.USER_MANAGE],
  get_user: [PERMISSIONS.USER_MANAGE],
  get_user_details: [PERMISSIONS.USER_READ_SELF],
  list_user_roles: [PERMISSIONS.USER_MANAGE],
  update_user: [PERMISSIONS.USER_MANAGE],
  update_users_roles: [PERMISSIONS.USER_MANAGE],
  assign_users_groups: [PERMISSIONS.USER_MANAGE],
  update_my_profile: [PERMISSIONS.ACCOUNT_UPDATE_SELF],
  update_my_details: [PERMISSIONS.ACCOUNT_UPDATE_SELF],
  list_groups: [PERMISSIONS.GROUP_READ],
  get_group: [PERMISSIONS.GROUP_READ],
  list_user_groups: [PERMISSIONS.GROUP_READ],
  list_course_groups: [PERMISSIONS.GROUP_READ],
  create_group: [PERMISSIONS.GROUP_MANAGE],
  update_group: [PERMISSIONS.GROUP_MANAGE],
  add_group_language: [PERMISSIONS.GROUP_MANAGE],
  remove_group_language: [PERMISSIONS.GROUP_MANAGE],
  set_group_base_language: [PERMISSIONS.GROUP_MANAGE],
  set_user_groups: [PERMISSIONS.GROUP_MANAGE],
} satisfies Record<string, PermissionKey[]>;

export function registerMcpAdminTools(
  server: McpServer,
  services: { users: UserService; groups: GroupService; uploadGrants: McpUploadGrantService },
  run: McpToolRunner,
): void {
  const { users, groups, uploadGrants } = services;
  server.registerTool(
    "get_my_user",
    {
      description: "Read the authenticated user's own profile, roles and group memberships.",
      inputSchema: asMcpInputSchema(Schemas.emptyAdminInputSchema),
      annotations: { readOnlyHint: true },
    },
    async () =>
      run(MCP_ADMIN_TOOL_PERMISSIONS.get_my_user, (user) => users.getUserById(user.userId)),
  );

  server.registerTool(
    "get_my_user_details",
    {
      description: "Read the authenticated user's own description, contact details and job title.",
      inputSchema: asMcpInputSchema(Schemas.emptyAdminInputSchema),
      annotations: { readOnlyHint: true },
    },
    async () =>
      run(MCP_ADMIN_TOOL_PERMISSIONS.get_my_user_details, (user) =>
        users.getUserDetails(user.userId, user),
      ),
  );

  server.registerTool(
    "update_my_user",
    {
      description: "Update the authenticated user's own first name, last name or account email.",
      inputSchema: asMcpInputSchema(Schemas.updateMyUserInputSchema),
      annotations: { destructiveHint: false },
    },
    async (data) =>
      run(MCP_ADMIN_TOOL_PERMISSIONS.update_my_user, async (user) => {
        await users.updateUser(user.userId, data, user);
        return users.getUserById(user.userId);
      }),
  );

  server.registerTool(
    "request_my_avatar_upload",
    {
      description:
        "Request a short-lived multipart upload grant to replace the authenticated user's avatar. Upload image bytes to the returned native endpoint. Images must be square and no larger than 1024 by 1024 pixels.",
      inputSchema: asMcpInputSchema(Schemas.requestMyAvatarUploadInputSchema),
      annotations: { destructiveHint: false },
    },
    async (input) =>
      run(MCP_ADMIN_TOOL_PERMISSIONS.request_my_avatar_upload, (user) =>
        uploadGrants.issueUserAvatarGrant(user, input),
      ),
  );

  server.registerTool(
    "remove_my_avatar",
    {
      description: "Remove the authenticated user's own avatar while keeping their account.",
      inputSchema: asMcpInputSchema(Schemas.emptyAdminInputSchema),
      annotations: { destructiveHint: false },
    },
    async () =>
      run(MCP_ADMIN_TOOL_PERMISSIONS.remove_my_avatar, async (user) => {
        await users.updateUserProfile(user.userId, { userAvatar: null });
        return { userId: user.userId, updated: true };
      }),
  );
  server.registerTool(
    "list_users",
    {
      description:
        "List existing users with names, emails, roles and group memberships. Filter by text, role, archived status or group IDs.",
      inputSchema: asMcpInputSchema(Schemas.listUsersInputSchema),
      annotations: { readOnlyHint: true },
    },
    async ({ query, page, pageSize, sort, ...filters }) =>
      run(MCP_ADMIN_TOOL_PERMISSIONS.list_users, () =>
        users.getUsers({ filters: { ...filters, keyword: query }, page, perPage: pageSize, sort }),
      ),
  );

  server.registerTool(
    "get_user",
    {
      description:
        "Read one existing user's administrative profile, role slugs and managed groups.",
      inputSchema: asMcpInputSchema(Schemas.getUserInputSchema),
      annotations: { readOnlyHint: true },
    },
    async ({ userId, language }) =>
      run(MCP_ADMIN_TOOL_PERMISSIONS.get_user, () =>
        users.getUserById(userId, undefined, language),
      ),
  );

  server.registerTool(
    "get_user_details",
    {
      description:
        "Read a user's public profile and contact details when permitted by the existing profile visibility rules. Contact visibility depends on the authenticated actor.",
      inputSchema: asMcpInputSchema(Schemas.getUserInputSchema),
      annotations: { readOnlyHint: true },
    },
    async ({ userId }) =>
      run(MCP_ADMIN_TOOL_PERMISSIONS.get_user_details, (user) =>
        users.getUserDetails(userId, user),
      ),
  );

  server.registerTool(
    "list_user_roles",
    {
      description:
        "Discover existing role slugs available in this tenant for user role assignments.",
      inputSchema: asMcpInputSchema(Schemas.emptyAdminInputSchema),
      annotations: { readOnlyHint: true },
    },
    async () =>
      run(MCP_ADMIN_TOOL_PERMISSIONS.list_user_roles, async (user) => ({
        roles: await users.getRoles(user.tenantId),
      })),
  );

  server.registerTool(
    "update_user",
    {
      description:
        "Update an existing user's name, email, roles, complete group memberships or managed groups. Omitted fields stay unchanged; an empty groups array clears membership. Users cannot be created, deleted or archived with this tool.",
      inputSchema: asMcpInputSchema(Schemas.updateUserInputSchema),
      annotations: { destructiveHint: false },
    },
    async ({ userId, ...data }) =>
      run(MCP_ADMIN_TOOL_PERMISSIONS.update_user, async (user) => {
        await users.updateUser(userId, data, user);
        return users.getUserById(userId);
      }),
  );

  server.registerTool(
    "update_users_roles",
    {
      description:
        "Replace role assignments for existing users with the supplied role slugs. Existing sessions are revoked when permissions change. The actor cannot change their own roles with this bulk tool.",
      inputSchema: asMcpInputSchema(Schemas.updateUsersRolesInputSchema),
      annotations: { destructiveHint: false },
    },
    async (data) =>
      run(MCP_ADMIN_TOOL_PERMISSIONS.update_users_roles, async (user) => {
        await users.updateUsersRoles(data, user);
        return { updatedUserIds: data.userIds };
      }),
  );

  server.registerTool(
    "assign_users_groups",
    {
      description:
        "Replace each existing user's complete group memberships in bulk. Supply an empty groups array to remove memberships while keeping the user and groups.",
      inputSchema: asMcpInputSchema(Schemas.assignUsersGroupsInputSchema),
      annotations: { destructiveHint: false },
    },
    async ({ assignments }) =>
      run(MCP_ADMIN_TOOL_PERMISSIONS.assign_users_groups, async (user) => {
        await users.bulkAssignUsersToGroup(assignments, user);
        return { updatedUserIds: assignments.map(({ userId }) => userId) };
      }),
  );

  server.registerTool(
    "update_my_profile",
    {
      description:
        "Update the authenticated user's own name, description, contact information and job title.",
      inputSchema: asMcpInputSchema(Schemas.updateMyProfileInputSchema),
      annotations: { destructiveHint: false },
    },
    async (data) =>
      run(MCP_ADMIN_TOOL_PERMISSIONS.update_my_profile, async (user) => {
        await users.updateUserProfile(user.userId, data);
        return { userId: user.userId, updated: true };
      }),
  );

  server.registerTool(
    "update_my_details",
    {
      description:
        "Update the authenticated user's own description, contact email, contact phone number and job title.",
      inputSchema: asMcpInputSchema(Schemas.updateMyDetailsInputSchema),
      annotations: { destructiveHint: false },
    },
    async (data) =>
      run(MCP_ADMIN_TOOL_PERMISSIONS.update_my_details, async (user) => {
        await users.upsertUserDetails(user.userId, data);
        return { userId: user.userId, updated: true };
      }),
  );

  server.registerTool(
    "list_groups",
    {
      description: "List existing groups with localized names, characteristics and members.",
      inputSchema: asMcpInputSchema(Schemas.listGroupsInputSchema),
      annotations: { readOnlyHint: true },
    },
    async ({ query, page, pageSize, sort, language }) =>
      run(MCP_ADMIN_TOOL_PERMISSIONS.list_groups, async () => {
        const result = await groups.getAllGroups({
          filters: { keyword: query },
          page,
          perPage: pageSize,
          sort,
          language,
        });
        return { data: result.data, pagination: result.pagination };
      }),
  );

  server.registerTool(
    "get_group",
    {
      description:
        "Read one group's localized name, characteristics, available translations and base language.",
      inputSchema: asMcpInputSchema(Schemas.getGroupInputSchema),
      annotations: { readOnlyHint: true },
    },
    async ({ groupId, language }) =>
      run(MCP_ADMIN_TOOL_PERMISSIONS.get_group, () => groups.getGroupById(groupId, language)),
  );

  server.registerTool(
    "list_user_groups",
    {
      description: "List the groups an existing user belongs to.",
      inputSchema: asMcpInputSchema(Schemas.listUserGroupsInputSchema),
      annotations: { readOnlyHint: true },
    },
    async ({ userId, query, page, pageSize, sort, language }) =>
      run(MCP_ADMIN_TOOL_PERMISSIONS.list_user_groups, () =>
        groups.getUserGroups(
          { filters: { keyword: query }, page, perPage: pageSize, sort, language },
          userId,
        ),
      ),
  );

  server.registerTool(
    "list_course_groups",
    {
      description:
        "List groups assigned to a course, including mandatory enrollment and deadline settings.",
      inputSchema: asMcpInputSchema(Schemas.listCourseGroupsInputSchema),
      annotations: { readOnlyHint: true },
    },
    async ({ courseId, language }) =>
      run(MCP_ADMIN_TOOL_PERMISSIONS.list_course_groups, async () => ({
        groups: await groups.getGroupsByCourse(courseId, language),
      })),
  );

  server.registerTool(
    "create_group",
    {
      description:
        "Create a group in a supported base language. Reuse the idempotency key when retrying the same creation request.",
      inputSchema: asMcpInputSchema(Schemas.createGroupInputSchema),
      annotations: { destructiveHint: false },
    },
    async ({ idempotencyKey: _key, ...data }) =>
      run(MCP_ADMIN_TOOL_PERMISSIONS.create_group, (user) => groups.createGroup(data, user)),
  );

  server.registerTool(
    "update_group",
    {
      description:
        "Update a group's name and characteristic in the selected language. Omitted fields stay unchanged.",
      inputSchema: asMcpInputSchema(Schemas.updateGroupInputSchema),
      annotations: { destructiveHint: false },
    },
    async ({ groupId, ...data }) =>
      run(MCP_ADMIN_TOOL_PERMISSIONS.update_group, (user) =>
        groups.updateGroup(groupId, data, user),
      ),
  );

  server.registerTool(
    "add_group_language",
    {
      description: "Add an available translation to an existing group.",
      inputSchema: asMcpInputSchema(Schemas.groupLanguageInputSchema),
      annotations: { destructiveHint: false },
    },
    async ({ groupId, language }) =>
      run(MCP_ADMIN_TOOL_PERMISSIONS.add_group_language, (user) =>
        groups.createLanguage(groupId, language, user),
      ),
  );

  server.registerTool(
    "remove_group_language",
    {
      description:
        "Remove one group translation while keeping the group. Repeat the exact language as confirmLanguage. The base language cannot be removed.",
      inputSchema: asMcpInputSchema(Schemas.removeGroupLanguageInputSchema),
      annotations: { destructiveHint: true },
    },
    async ({ groupId, language, confirmLanguage }) =>
      run(MCP_ADMIN_TOOL_PERMISSIONS.remove_group_language, (user) => {
        if (language !== confirmLanguage)
          throw new BadRequestException("Group language confirmation does not match");
        return groups.deleteLanguage(groupId, language, user);
      }),
  );

  server.registerTool(
    "set_group_base_language",
    {
      description: "Choose an existing group translation as its base language.",
      inputSchema: asMcpInputSchema(Schemas.groupBaseLanguageInputSchema),
      annotations: { destructiveHint: false },
    },
    async ({ groupId, baseLanguage }) =>
      run(MCP_ADMIN_TOOL_PERMISSIONS.set_group_base_language, (user) =>
        groups.updateBaseLanguage(groupId, { baseLanguage }, user),
      ),
  );

  server.registerTool(
    "set_user_groups",
    {
      description:
        "Replace one existing user's complete group memberships. An empty groupIds array clears membership while keeping the user and groups.",
      inputSchema: asMcpInputSchema(Schemas.setUserGroupsInputSchema),
      annotations: { destructiveHint: false },
    },
    async ({ userId, groupIds }) =>
      run(MCP_ADMIN_TOOL_PERMISSIONS.set_user_groups, async (user) => {
        await groups.setUserGroups(groupIds, userId, { actor: user });
        return { userId, groupIds };
      }),
  );
}
