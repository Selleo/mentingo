import { Controller, Delete, HttpCode, HttpStatus, Param, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import { UUIDSchema, type UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";

import { DirectorySyncConnectionService } from "./services/directory-sync-connection.service";

@ApiTags("Directory Sync")
@Controller("directory-sync/users")
@UseGuards(PermissionsGuard)
export class DirectorySyncUserController {
  constructor(private readonly directorySyncConnectionService: DirectorySyncConnectionService) {}

  @Delete(":userId/role-override")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  @ApiOperation({ summary: "Let the directory manage a synced user's roles again" })
  @Validate({ request: [{ type: "param", name: "userId", schema: UUIDSchema }] })
  async restoreDirectoryRoles(@Param("userId") userId: UUIDType): Promise<void> {
    await this.directorySyncConnectionService.restoreDirectoryRoles(userId);
  }
}
