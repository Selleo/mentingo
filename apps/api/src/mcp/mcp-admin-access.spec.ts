import { PERMISSIONS } from "@repo/shared";

import { MCP_ADMIN_TOOL_PERMISSIONS } from "./mcp-admin-tools";
import { MCP_CUSTOMIZATION_TOOL_NAMES } from "./mcp-customization-tools";
import { canListMcpTool, capabilityForMcpTool } from "./mcp-tool-access";

import type { SettingsService } from "src/settings/settings.service";

const settings = {} as Awaited<ReturnType<SettingsService["getGlobalSettings"]>>;

describe("MCP administration discovery", () => {
  it.each(Object.entries(MCP_ADMIN_TOOL_PERMISSIONS))(
    "%s is advertised only with its domain permission",
    (tool, requiredPermissions) => {
      expect(capabilityForMcpTool(tool)).not.toBeNull();
      expect(canListMcpTool(tool, requiredPermissions, settings)).toBe(true);
      expect(canListMcpTool(tool, [], settings)).toBe(false);
      expect(canListMcpTool(tool, [PERMISSIONS.COURSE_UPDATE], settings)).toBe(false);
    },
  );

  it.each(MCP_CUSTOMIZATION_TOOL_NAMES)("%s requires platform management", (tool) => {
    expect(capabilityForMcpTool(tool)).not.toBeNull();
    expect(canListMcpTool(tool, [PERMISSIONS.SETTINGS_MANAGE], settings)).toBe(true);
    expect(canListMcpTool(tool, [PERMISSIONS.USER_MANAGE], settings)).toBe(false);
    expect(canListMcpTool(tool, [], settings)).toBe(false);
  });

  it.each([
    "create_user",
    "import_users",
    "delete_user",
    "delete_users",
    "archive_users",
    "delete_group",
    "delete_groups",
    "change_password",
    "reset_user_password",
    "update_platform_sso",
    "update_platform_mfa",
  ])("excluded operation %s is unavailable even to administrators", (tool) => {
    expect(capabilityForMcpTool(tool)).toBeNull();
    expect(canListMcpTool(tool, Object.values(PERMISSIONS), settings)).toBe(false);
  });
});
