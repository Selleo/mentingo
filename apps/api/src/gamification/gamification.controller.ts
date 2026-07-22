import { Controller, Get } from "@nestjs/common";

import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";

import { GamificationService } from "./gamification.service";

@Controller("gamification")
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get("user-progress")
  async getUserProgress(@CurrentUser() currentUser: CurrentUserType) {
    await this.gamificationService.getUserProgress(currentUser);
  }
}
