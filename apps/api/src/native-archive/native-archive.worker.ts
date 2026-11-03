import path from "node:path";

import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Worker } from "bullmq";
import { match } from "ts-pattern";

import { QUEUE_NAMES, QUEUE_SANDBOX_PROCESS_ENV, QueueService } from "src/queue";

import { NativeArchiveJobFulfillmentService } from "./services/native-archive-job-fulfillment.service";
import { createNativeArchiveProgressReporter } from "./utils/native-archive-job-progress.utils";

import type { NativeArchiveJob, NativeArchiveJobResult } from "./native-archive.types";

const NATIVE_ARCHIVE_SANDBOX_PATH = path.join(__dirname, "native-archive-job.sandbox.js");

/** BullMQ forks compiled JavaScript; Jest and tsx run TypeScript sources, so they fulfill jobs in-process. */
const canFulfillJobsInSandbox = path.extname(__filename) === ".js";

/**
 * Consumes the native-archive queue. In compiled builds every job runs in a forked sandbox
 * process, so unzipping, validation, storage copies, and the import transaction never block the
 * API's event loop.
 */
@Injectable()
export class NativeArchiveWorker implements OnModuleDestroy {
  private readonly logger = new Logger(NativeArchiveWorker.name);
  private readonly worker: Worker<NativeArchiveJob, NativeArchiveJobResult>;

  constructor(
    private readonly queueService: QueueService,
    private readonly nativeArchiveJobFulfillmentService: NativeArchiveJobFulfillmentService,
  ) {
    this.worker = match(canFulfillJobsInSandbox)
      .with(true, () => this.createSandboxedWorker())
      .with(false, () => this.createInProcessWorker())
      .exhaustive();

    this.worker.on("failed", (job, error) => {
      this.logger.error(`Native archive job ${job?.id} failed: ${error.message}`);
    });
  }

  private createSandboxedWorker() {
    return new Worker<NativeArchiveJob, NativeArchiveJobResult>(
      QUEUE_NAMES.NATIVE_ARCHIVE,
      NATIVE_ARCHIVE_SANDBOX_PATH,
      {
        connection: this.queueService.getConnection(),
        concurrency: 1,
        workerForkOptions: {
          env: {
            ...process.env,
            [QUEUE_SANDBOX_PROCESS_ENV]: "true",
            DISABLE_OUTBOX_PROCESSING: "true",
          },
        },
      },
    );
  }

  private createInProcessWorker() {
    return new Worker<NativeArchiveJob, NativeArchiveJobResult>(
      QUEUE_NAMES.NATIVE_ARCHIVE,
      (job) =>
        this.nativeArchiveJobFulfillmentService.fulfillArchiveJob(
          String(job.id),
          job.data,
          createNativeArchiveProgressReporter((progress) => job.updateProgress(progress)),
        ),
      { connection: this.queueService.getConnection(), concurrency: 1 },
    );
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
