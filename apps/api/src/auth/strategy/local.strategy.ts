import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";

import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { TenantResolverService } from "src/storage/db/tenant-resolver.service";

import { AuthService } from "../auth.service";

import type { Request } from "express";
import type { CommonUser } from "src/common/schemas/common-user.schema";

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    private readonly tenantResolver: TenantResolverService,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {
    super({ usernameField: "email", passReqToCallback: true });
  }

  async validate(req: Request, email: string, password: string): Promise<CommonUser> {
    const tenantId = await this.tenantResolver.resolveTenantId(req);

    if (!tenantId) throw new UnauthorizedException("Missing tenantId");

    const user = await this.tenantRunner.runWithTenant(tenantId, () =>
      this.authService.validateUser(email, password),
    );

    if (!user) throw new UnauthorizedException("Invalid email or password");

    return user;
  }
}
