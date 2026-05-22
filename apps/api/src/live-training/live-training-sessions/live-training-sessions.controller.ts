import { Controller, UseGuards } from "@nestjs/common";
import { FEATURES } from "@repo/shared";

import { RequireFeature } from "src/common/decorators/require-feature.decorator";
import { FeaturesGuard } from "src/common/guards/features.guard";
import { PermissionsGuard } from "src/common/guards/permissions.guard";

import { LiveTrainingSessionsService } from "./live-training-sessions.service";

@UseGuards(FeaturesGuard, PermissionsGuard)
@RequireFeature(FEATURES.LIVE_TRAINING)
@Controller("live-training/:liveTrainingId/sessions")
export class LiveTrainingSessionsController {
  constructor(private readonly liveTrainingSessionsService: LiveTrainingSessionsService) {}
}
