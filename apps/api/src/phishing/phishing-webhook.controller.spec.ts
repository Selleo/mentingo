import { createHmac, randomUUID } from "node:crypto";

import { UnauthorizedException } from "@nestjs/common";

import { PhishingWebhookController } from "./phishing-webhook.controller";

import type { PhishingClientService } from "./phishing-client.service";
import type { PhishingRepository } from "./phishing.repository";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import type { CourseService } from "src/courses/course.service";
import type { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
jest.mock("src/courses/course.service", () => ({ CourseService: jest.fn() }));
describe("phishing enrollment webhook", () => {
  const secret = "s".repeat(32);
  const event = {
    id: randomUUID(),
    tenantId: randomUUID(),
    userId: randomUUID(),
    campaignId: randomUUID(),
    action: "clicked",
  };
  const courseId = randomUUID(),
    actorId = randomUUID();
  const report = {
    campaign: { id: event.campaignId, courseId, createdBy: actorId },
    recipients: [{ userId: event.userId, clickedAt: "now" }],
  };
  const request = () => {
    const rawBody = Buffer.from(JSON.stringify(event)),
      timestamp = String(Math.floor(Date.now() / 1000));
    return {
      body: event,
      rawBody,
      headers: {
        "x-phishing-timestamp": timestamp,
        "x-phishing-signature": createHmac("sha256", secret)
          .update(timestamp + ".")
          .update(rawBody)
          .digest("hex"),
      },
    } as unknown as RawBodyRequest<Request>;
  };
  const setup = () => {
    let enrolled = false;
    const runWithTenant = jest.fn(async (_id, fn) => fn());
    const runner = { runWithTenant, transaction: jest.fn(async (fn) => fn()) };
    const client = { secret: jest.fn(async () => secret), run: jest.fn(async () => report) };
    const repository = {
      lockEnrollment: jest.fn(),
      user: jest.fn(async (id) => ({ id, email: "test@example.test" })),
      course: jest.fn(async () => ({ id: courseId })),
      enrollment: jest.fn(async () => (enrolled ? [{ status: "enrolled" }] : [])),
    };
    const courses = {
      enrollCourse: jest.fn(async () => {
        enrolled = true;
      }),
    };
    const controller = new PhishingWebhookController(
      runner as unknown as TenantDbRunnerService,
      client as unknown as PhishingClientService,
      repository as unknown as PhishingRepository,
      courses as unknown as CourseService,
    );
    return { controller, runner, client, repository, courses };
  };
  it("enrolls in the authenticated tenant only once across retries", async () => {
    const { controller, runner, repository, courses } = setup();
    await controller.webhook(request());
    await controller.webhook(request());
    expect(runner.runWithTenant).toHaveBeenCalledWith(event.tenantId, expect.any(Function));
    expect(repository.lockEnrollment).toHaveBeenCalledWith(event.tenantId, courseId, event.userId);
    expect(courses.enrollCourse).toHaveBeenCalledTimes(1);
    expect(courses.enrollCourse).toHaveBeenCalledWith(
      courseId,
      event.userId,
      undefined,
      undefined,
      expect.objectContaining({ userId: actorId, tenantId: event.tenantId }),
    );
  });
  it("rejects tampering before contacting the engine or enrolling", async () => {
    const { controller, client, courses } = setup();
    const req = request();
    req.rawBody = Buffer.from("{}");
    await expect(controller.webhook(req)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(client.run).not.toHaveBeenCalled();
    expect(courses.enrollCourse).not.toHaveBeenCalled();
  });
  it("does not enroll users outside the campaign", async () => {
    const { controller, client, courses } = setup();
    client.run.mockResolvedValue({ ...report, recipients: [] });
    await expect(controller.webhook(request())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(courses.enrollCourse).not.toHaveBeenCalled();
  });
});
