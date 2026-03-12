import { Controller, Post } from "@nestjs/common";

import { Public } from "src/common/decorators/public.decorator";
import { OnlyStaging } from "src/common/decorators/staging.decorator";
import { PERMISSIONS } from "src/permission/permission.constants";
import { RequirePermission } from "src/permission/permission.decorator";

import { TestConfigService } from "../test-config.service";

@Controller("test-config")
export class TestConfigController {
  constructor(private testConfigService: TestConfigService) {}

  @Public()
  @Post("setup")
  @RequirePermission(PERMISSIONS.ACCOUNT_ACCESS_PUBLIC)
  @OnlyStaging()
  async setup(): Promise<void> {
    return this.testConfigService.setup();
  }

  @Post("teardown")
  @RequirePermission(PERMISSIONS.ACCOUNT_ACCESS_PUBLIC)
  @OnlyStaging()
  async teardown(): Promise<void> {
    return this.testConfigService.teardown();
  }
}
