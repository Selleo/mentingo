export const QUEUE_SANDBOX_PROCESS_ENV = "QUEUE_SANDBOX_PROCESS";

/**
 * True inside a child process BullMQ forks to run sandboxed jobs. Such a process serves no
 * sockets and must not start crons, outbox processing, or workers of other queues.
 */
export const isQueueSandboxProcess = () => process.env[QUEUE_SANDBOX_PROCESS_ENV] === "true";
