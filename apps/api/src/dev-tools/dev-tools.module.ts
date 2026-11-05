import { Module } from "@nestjs/common";

import { AuthModule } from "src/auth/auth.module";

import { DevToolsController } from "./dev-tools.controller";

// Never enable outside a local machine: it lets anyone log in as any user without a password or MFA.
export const isDevToolsEnabled = (env: NodeJS.ProcessEnv) =>
  env.DEV_USER_SWITCHER === "true" &&
  !["production", "staging", "test"].includes(env.NODE_ENV ?? "");

@Module({
  imports: [AuthModule],
  controllers: [DevToolsController],
})
export class DevToolsModule {}
