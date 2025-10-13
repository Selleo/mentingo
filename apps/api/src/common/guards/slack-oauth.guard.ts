import { ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthGuard } from "@nestjs/passport";

import { EnvService } from "src/env/services/env.service";

import type { ExecutionContext } from "@nestjs/common";

@Injectable()
export class SlackOAuthGuard extends AuthGuard("slack") {
  constructor(
    private readonly envService: EnvService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  private async isEnabled(): Promise<boolean> {
    const enabled = await this.envService
      .getEnv("SLACK_OAUTH_ENABLED")
      .then((r) => r.value)
      .catch(() => this.configService.get<string>("SLACK_OAUTH_ENABLED"));

    return enabled === "true";
  }

  async canActivate(context: ExecutionContext) {
    const enabled = await this.isEnabled();
    if (!enabled) {
      throw new ForbiddenException("Slack OAuth is disabled");
    }
    return super.canActivate(context) as any;
  }
}
