import { NestFactory } from "@nestjs/core";

import { setupValidation } from "src/utils/setup-validation";

import { NativeArchiveSandboxModule } from "./native-archive-sandbox.module";
import { NativeArchiveJobFulfillmentService } from "./services/native-archive-job-fulfillment.service";
import { createNativeArchiveProgressReporter } from "./utils/native-archive-job-progress.utils";

import type { NativeArchiveJob, NativeArchiveJobResult } from "./native-archive.types";
import type { INestApplicationContext } from "@nestjs/common";
import type { SandboxedJob } from "bullmq";

let sandboxContext: Promise<INestApplicationContext> | undefined;

async function bootSandboxContext(): Promise<INestApplicationContext> {
  setupValidation();

  return NestFactory.createApplicationContext(NativeArchiveSandboxModule, {
    logger: ["error", "warn", "log"],
  });
}

process.once("disconnect", () => process.exit(1));

/**
 * Entry point BullMQ loads in the forked sandbox process. The Nest context is booted by the first
 * job and reused by later ones while BullMQ keeps the process alive.
 */
export default async function fulfillNativeArchiveJobInSandbox(
  job: SandboxedJob<NativeArchiveJob, NativeArchiveJobResult>,
): Promise<NativeArchiveJobResult> {
  sandboxContext ??= bootSandboxContext().catch((error) => {
    sandboxContext = undefined;
    throw error;
  });

  const context = await sandboxContext;

  return context.get(NativeArchiveJobFulfillmentService).fulfillArchiveJob(
    String(job.id),
    job.data,
    createNativeArchiveProgressReporter((progress) => job.updateProgress(progress)),
  );
}
