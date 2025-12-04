import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type Job, type JobsOptions, type ConnectionOptions, Queue, QueueEvents } from "bullmq";

import { buildRedisConnection } from "src/common/configuration/redis";
import { QUEUE_NAMES, type QueueName } from "src/queue/queue.types";

import type { RedisConfigSchema } from "src/common/configuration/redis";

interface QueueInstance {
  queue: Queue;
  events: QueueEvents;
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private queues: Map<QueueName, QueueInstance> = new Map();
  private connection: ConnectionOptions;

  constructor(private readonly configService: ConfigService) {
    const redisCfg = this.configService.get("redis") as RedisConfigSchema | undefined;
    if (!redisCfg) {
      throw new Error("Redis configuration is required for QueueService");
    }

    this.connection = buildRedisConnection(redisCfg);
  }

  onModuleInit() {
    for (const name of Object.values(QUEUE_NAMES)) {
      this.initializeQueue(name);
    }
  }

  private initializeQueue(name: QueueName): QueueInstance {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const queue = new Queue(name, { connection: this.connection });
    const events = new QueueEvents(name, { connection: this.connection });

    const instance = { queue, events };
    this.queues.set(name, instance);

    return instance;
  }

  getQueue(name: QueueName): Queue {
    const instance = this.queues.get(name);
    if (!instance) {
      throw new Error(`Queue ${name} not initialized`);
    }

    return instance.queue;
  }

  getQueueEvents(name: QueueName): QueueEvents {
    const instance = this.queues.get(name);
    if (!instance) {
      throw new Error(`Queue ${name} not initialized`);
    }

    return instance.events;
  }

  async enqueue<T>(
    queueName: QueueName,
    jobName: string,
    data: T,
    options?: JobsOptions,
  ): Promise<Job<T>> {
    const queue = this.getQueue(queueName);

    return queue.add(jobName, data, options) as Promise<Job<T>>;
  }

  async waitForJobsCompletion(queueName: QueueName, jobs: Job[]) {
    const events = this.getQueueEvents(queueName);
    await events.waitUntilReady();

    return Promise.allSettled(jobs.map((j) => j.waitUntilFinished(events)));
  }

  getConnection(): ConnectionOptions {
    return this.connection;
  }

  async onModuleDestroy() {
    const closePromises: Promise<void>[] = [];

    for (const instance of this.queues.values()) {
      closePromises.push(instance.queue.close());
      closePromises.push(instance.events.close());
    }

    await Promise.all(closePromises);
  }
}
