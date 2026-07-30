import { Controller, Get, Param } from "@nestjs/common";

import { UUIDType } from "src/common";

import { GamificationService } from "./gamification.service";

@Controller("gamification")
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get("user-progress/:userId")
  async getUserProgress(@Param("userId") userId: UUIDType) {
    return await this.gamificationService.getUserProgress(userId);
  }
}
