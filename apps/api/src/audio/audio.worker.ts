import { Inject, Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Worker } from "bullmq";

import { AUDIO_PROCESSORS } from "src/audio/audio.tokens";
import { QUEUE_NAMES, QueueService } from "src/queue";

import type { Job } from "bullmq";
import type { AudioProcessor } from "src/audio/types/audio.types";

@Injectable()
export class AudioWorker implements OnModuleDestroy {
  private worker: Worker;
  private map: Map<string, AudioProcessor>;
  private readonly logger = new Logger(AudioWorker.name);

  constructor(
    @Inject(AUDIO_PROCESSORS) processors: AudioProcessor[],
    private readonly queueService: QueueService,
  ) {
    this.map = new Map(processors.map((processor) => [processor.name, processor]));

    const connection = this.queueService.getConnection();

    this.worker = new Worker(
      QUEUE_NAMES.AUDIO,
      async (job: Job) => {
        const processor = this.map.get(job.name);
        if (!processor) throw new Error(`Unknown job: ${job.name}`);

        return processor.run(job.data);
      },
      {
        connection,
        concurrency: 5,
      },
    );

    this.worker.on("completed", (job) => this.logger.log(`Job finished - ${job.id} - ${job.name}`));
    this.worker.on("failed", (job, error) =>
      this.logger.error(
        `Job failed - ID: ${job?.id}, Name: ${job?.name}, Reason: ${error?.message}`,
        error?.stack,
      ),
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
