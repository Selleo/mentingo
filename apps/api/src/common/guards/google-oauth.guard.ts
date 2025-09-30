import { type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthGuard } from "@nestjs/passport";

import { EnvService } from "src/env/services/env.service";

@Injectable()
export class GoogleOAuthGuard extends AuthGuard("google") {
  constructor(
    private readonly envService: EnvService,
    private readonly configService: ConfigService,
  ) {
    super({ accessType: "offline", prompt: "consent" });
  }

  private async isEnabled(): Promise<boolean> {
    const enabled =
      (await this.envService
        .getEnv("GOOGLE_OAUTH_ENABLED")
        .then((r) => r.value)
        .catch(() => undefined)) || this.configService.get<string>("GOOGLE_OAUTH_ENABLED");

    return enabled === "true";
  }

  async canActivate(context: ExecutionContext) {
    const enabled = await this.isEnabled();
    if (!enabled) {
      throw new ForbiddenException("Google OAuth is disabled");
    }
    return super.canActivate(context) as any;
  }
}
