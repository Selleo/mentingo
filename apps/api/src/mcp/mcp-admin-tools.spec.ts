import { PERMISSIONS } from "@repo/shared";
import { FormatRegistry } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { AuthController } from "src/auth/auth.controller";
import { REQUIRED_PERMISSIONS_KEY } from "src/common/decorators/require-permission.decorator";
import { GroupController } from "src/group/group.controller";
import { UserController } from "src/user/user.controller";

import {
  requestMyAvatarUploadInputSchema,
  emptyAdminInputSchema,
  updateMyUserInputSchema,
  updateUserInputSchema,
} from "./mcp-admin-tool.schemas";
import { MCP_ADMIN_TOOL_PERMISSIONS, registerMcpAdminTools } from "./mcp-admin-tools";

import type { McpToolRunner } from "./mcp-tool-runner.types";
import type { McpUploadGrantService } from "./mcp-upload-grant.service";
import type { McpServer } from "@modelcontextprotocol/server";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { GroupService } from "src/group/group.service";
import type { UserService } from "src/user/user.service";

describe("MCP administrative tools", () => {
  const actor: CurrentUserType = {
    userId: "actor-id",
    tenantId: "tenant-id",
    email: "actor@example.com",
    roleSlugs: [],
    permissions: [],
  };
  function setup() {
    const handlers = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>();
    const server = {
      registerTool: jest.fn((name, _config, callback) => handlers.set(name, callback)),
    };
    const users = {
      getUserById: jest.fn().mockResolvedValue({ id: actor.userId }),
      updateUserProfile: jest.fn().mockResolvedValue(undefined),
      updateUser: jest.fn().mockResolvedValue(undefined),
      updateUsersRoles: jest.fn().mockResolvedValue(undefined),
      getUserDetails: jest.fn().mockResolvedValue({ id: actor.userId }),
      bulkAssignUsersToGroup: jest.fn().mockResolvedValue(undefined),
    };
    const groups = {
      setUserGroups: jest.fn().mockResolvedValue(undefined),
      deleteLanguage: jest.fn(),
    };
    const uploadGrants = {
      issueUserAvatarGrant: jest
        .fn()
        .mockResolvedValue({ token: "grant-token", uploadPath: "/api/user/profile" }),
    };
    const run = jest.fn(async (_permissions, operation) => ({
      content: [],
      structuredContent: await operation(actor),
    }));
    registerMcpAdminTools(
      server as unknown as McpServer,
      {
        users: users as unknown as UserService,
        groups: groups as unknown as GroupService,
        uploadGrants: uploadGrants as unknown as McpUploadGrantService,
      },
      run as McpToolRunner,
    );
    return { users, groups, uploadGrants, run, handlers };
  }

  it("does not register user creation, entity deletion, archive or credential operations", () => {
    const { handlers } = setup();
    expect([...handlers.keys()].sort()).toEqual(Object.keys(MCP_ADMIN_TOOL_PERMISSIONS).sort());
    for (const name of [
      "create_user",
      "delete_user",
      "delete_group",
      "archive_users",
      "reset_user_password",
    ]) {
      expect(handlers.has(name)).toBe(false);
    }
    expect(updateUserInputSchema.additionalProperties).toBe(false);
    expect(updateUserInputSchema.properties).not.toHaveProperty("archived");
    expect(updateMyUserInputSchema.properties).not.toHaveProperty("roleSlugs");
  });

  it("binds self reads and updates to the authenticated actor", async () => {
    const { users, handlers, run } = setup();
    await handlers.get("get_my_user")!({ userId: "other-user" });
    expect(run).toHaveBeenLastCalledWith([PERMISSIONS.ACCOUNT_READ_SELF], expect.any(Function));
    expect(users.getUserById).toHaveBeenCalledWith(actor.userId);
    await handlers.get("update_my_user")!({ firstName: "New name" });
    expect(users.updateUser).toHaveBeenCalledWith(actor.userId, { firstName: "New name" }, actor);
  });

  it("requests native avatar upload grants using metadata bound to the actor", async () => {
    const { handlers, uploadGrants, run } = setup();
    const input = { filename: "avatar.jpg", mimeType: "image/jpeg", size: 1024 };
    await handlers.get("request_my_avatar_upload")!(input);
    expect(run).toHaveBeenLastCalledWith([PERMISSIONS.ACCOUNT_UPDATE_SELF], expect.any(Function));
    expect(uploadGrants.issueUserAvatarGrant).toHaveBeenCalledWith(actor, input);
    expect(Value.Check(requestMyAvatarUploadInputSchema, input)).toBe(true);
    expect(Value.Check(requestMyAvatarUploadInputSchema, { ...input, base64: "aGVsbG8=" })).toBe(
      false,
    );
    expect(Value.Check(requestMyAvatarUploadInputSchema, { ...input, userId: "other-user" })).toBe(
      false,
    );
    expect(
      Value.Check(requestMyAvatarUploadInputSchema, { ...input, size: 5 * 1024 * 1024 + 1 }),
    ).toBe(false);
    expect(Value.Check(requestMyAvatarUploadInputSchema, { ...input, size: 0 })).toBe(false);
    expect(
      Value.Check(requestMyAvatarUploadInputSchema, { ...input, mimeType: "text/plain" }),
    ).toBe(false);
  });

  it("removes only the authenticated user's avatar without accepting file bytes", async () => {
    const { handlers, users } = setup();
    await handlers.get("remove_my_avatar")!({});
    expect(users.updateUserProfile).toHaveBeenCalledWith(actor.userId, { userAvatar: null });
    expect(Value.Check(emptyAdminInputSchema, { base64: "aGVsbG8=" })).toBe(false);
  });

  it("passes the actor to membership updates and preserves empty membership replacement", async () => {
    const { groups, handlers, run } = setup();
    await handlers.get("set_user_groups")!({ userId: "target-user", groupIds: [] });
    expect(run).toHaveBeenLastCalledWith([PERMISSIONS.GROUP_MANAGE], expect.any(Function));
    expect(groups.setUserGroups).toHaveBeenCalledWith([], "target-user", { actor });
  });

  it("rejects translation removal without matching confirmation before domain mutation", async () => {
    const { groups, handlers } = setup();
    await expect(
      handlers.get("remove_group_language")!({
        groupId: "group",
        language: "en",
        confirmLanguage: "pl",
      }),
    ).rejects.toThrow("Group language confirmation does not match");
    expect(groups.deleteLanguage).not.toHaveBeenCalled();
  });
});

const restHandlers = {
  get_my_user: AuthController.prototype.currentUser,
  get_my_user_details: UserController.prototype.getUserDetails,
  get_user_details: UserController.prototype.getUserDetails,
  update_my_user: UserController.prototype.updateUser,
  request_my_avatar_upload: UserController.prototype.updateUserProfile,
  remove_my_avatar: UserController.prototype.updateUserProfile,
  list_users: UserController.prototype.getUsers,
  get_user: UserController.prototype.getUserById,
  list_user_roles: UserController.prototype.getRoles,
  update_user: UserController.prototype.adminUpdateUser,
  update_users_roles: UserController.prototype.bulkUpdateUsersRoles,
  assign_users_groups: UserController.prototype.bulkAssignUsersToGroup,
  update_my_profile: UserController.prototype.updateUserProfile,
  update_my_details: UserController.prototype.upsertUserDetails,
  list_groups: GroupController.prototype.getAllGroups,
  get_group: GroupController.prototype.getGroupById,
  list_user_groups: GroupController.prototype.getUserGroups,
  list_course_groups: GroupController.prototype.getGroupsByCourse,
  create_group: GroupController.prototype.createGroup,
  update_group: GroupController.prototype.updateGroup,
  add_group_language: GroupController.prototype.createLanguage,
  remove_group_language: GroupController.prototype.deleteLanguage,
  set_group_base_language: GroupController.prototype.updateBaseLanguage,
  set_user_groups: GroupController.prototype.setUserGroups,
};

describe("MCP user and group REST parity", () => {
  it.each(
    Object.keys(MCP_ADMIN_TOOL_PERMISSIONS) as Array<keyof typeof MCP_ADMIN_TOOL_PERMISSIONS>,
  )("%s matches its REST handler permission metadata", (name) =>
    expect(MCP_ADMIN_TOOL_PERMISSIONS[name]).toEqual(
      Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, restHandlers[name]),
    ),
  );

  it("rejects archived mutations, self privilege fields and group names in UUID memberships", () => {
    const previousUuid = FormatRegistry.Get("uuid");
    FormatRegistry.Set("uuid", (value) =>
      /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value),
    );
    try {
      const userId = "01234567-0123-4567-89ab-0123456789ab";
      expect(Value.Check(updateUserInputSchema, { userId, firstName: "Allowed" })).toBe(true);
      expect(Value.Check(updateUserInputSchema, { userId, archived: true })).toBe(false);
      expect(Value.Check(updateUserInputSchema, { userId, groups: ["Finance"] })).toBe(false);
      expect(
        Value.Check(updateMyUserInputSchema, { firstName: "Allowed", roleSlugs: ["admin"] }),
      ).toBe(false);
    } finally {
      if (previousUuid) FormatRegistry.Set("uuid", previousUuid);
      else FormatRegistry.Delete("uuid");
    }
  });
});
