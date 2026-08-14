import { Injectable } from "@nestjs/common";

import { QUEUE_NAMES, QueueService } from "src/queue";

import type { Job } from "bullmq";
import type { AiMentorPracticeJobData } from "src/ai/ai-practice.types";

export const AI_MENTOR_PRACTICE_JOB_NAME = "generate-ai-mentor-practice";

@Injectable()
export class AiPracticeQueueService {
  constructor(private readonly queueService: QueueService) {}

  enqueue(data: AiMentorPracticeJobData): Promise<Job<AiMentorPracticeJobData>> {
    return this.queueService.enqueue(
      QUEUE_NAMES.AI_MENTOR_PRACTICE,
      AI_MENTOR_PRACTICE_JOB_NAME,
      data,
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}
