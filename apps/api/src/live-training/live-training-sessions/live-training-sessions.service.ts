import { Injectable } from "@nestjs/common";

import { LiveTrainingSessionsRepository } from "./live-training-sessions.repository";

@Injectable()
export class LiveTrainingSessionsService {
  constructor(private readonly liveTrainingSessionsRepository: LiveTrainingSessionsRepository) {}
}
