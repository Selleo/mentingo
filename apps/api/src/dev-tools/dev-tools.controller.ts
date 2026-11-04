import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { Response } from "express";

import { AuthService } from "src/auth/auth.service";
import { TokenService } from "src/auth/token.service";
import { BaseResponse, DatabasePg } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { DB } from "src/storage/db/db.providers";
import { permissionRoles, permissionUserRoles, users } from "src/storage/schema";

// Local-only user switcher; DevToolsModule is registered only when isDevToolsEnabled() is true.
// Excluded from Swagger so the generated client does not change with a local env flag.
@ApiExcludeController()
@Public()
@Controller("dev/users")
export class DevToolsController {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
  ) {}

  @Get()
  async listUsers() {
    // DB is scoped to the tenant resolved from the request host by TenantRlsInterceptor.
    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        roles: sql<string>`coalesce(string_agg(${permissionRoles.slug}, ', ' order by ${permissionRoles.slug}), '')`,
      })
      .from(users)
      .leftJoin(permissionUserRoles, eq(permissionUserRoles.userId, users.id))
      .leftJoin(permissionRoles, eq(permissionRoles.id, permissionUserRoles.roleId))
      .where(and(eq(users.archived, false), isNull(users.deletedAt)))
      .groupBy(users.id)
      .orderBy(asc(users.email));

    return new BaseResponse(rows);
  }

  @Post(":id/login")
  async loginAs(
    @Param("id", ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<null> {
    const [user] = await this.db
      .select({ id: users.id, email: users.email, tenantId: users.tenantId })
      .from(users)
      .where(and(eq(users.id, id), eq(users.archived, false), isNull(users.deletedAt)));

    if (!user) throw new NotFoundException("User not found");

    const { accessToken, refreshToken } = await this.authService.issueSessionTokens(user);
    this.tokenService.setTokenCookies(response, accessToken, refreshToken);

    return null;
  }
}
