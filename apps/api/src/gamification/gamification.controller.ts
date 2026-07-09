import { Controller } from "@nestjs/common";

import { GamificationService } from "./gamification.service";

@Controller("gamification")
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}
}
