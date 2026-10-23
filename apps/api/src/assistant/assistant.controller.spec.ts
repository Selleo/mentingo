import { Test } from "@nestjs/testing";
import request from "supertest";

import { AssistantController } from "./assistant.controller";
import { AssistantService } from "./assistant.service";

import type { INestApplication } from "@nestjs/common";

describe("Assistant HTTP query validation", () => {
  let app: INestApplication;
  const listThreads = jest.fn(async () => ({ items: [], page: 1, perPage: 30, totalItems: 0 }));

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AssistantController],
      providers: [
        {
          provide: AssistantService,
          useValue: {
            listThreads,
            getThread: async () => ({
              id: "8a44eae9-76c2-425c-baa5-443b9688f4d0",
              title: "A thread",
              language: "en",
              archived: false,
              createdAt: "2026-10-23T12:00:00Z",
              updatedAt: "2026-10-23T12:00:00Z",
              latestRun: {
                id: "8a44eae9-76c2-425c-baa5-443b9688f4d1",
                threadId: "8a44eae9-76c2-425c-baa5-443b9688f4d0",
                status: "running",
                activity: "searching",
                workflowRunId: null,
                errorCode: null,
                createdAt: "2026-10-23T12:00:00Z",
                updatedAt: "2026-10-23T12:00:00Z",
              },
            }),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    listThreads.mockClear();
  });

  it.each([false, true])(
    "accepts the frontend's archived=%s query and coerces pagination",
    async (archived) => {
      await request(app.getHttpServer())
        .get("/api/assistant/threads")
        .query({ page: 1, perPage: 30, archived })
        .expect(200);
      expect(listThreads).toHaveBeenCalledWith(null, {
        page: 1,
        perPage: 30,
        archived,
        query: undefined,
      });
    },
  );

  it("allows the archived filter to be omitted", async () => {
    await request(app.getHttpServer()).get("/api/assistant/threads").expect(200);
    expect(listThreads).toHaveBeenCalledWith(null, {
      page: undefined,
      perPage: undefined,
      archived: undefined,
      query: undefined,
    });
  });

  it.each(["anything", "0", "1"])(
    "rejects invalid archived=%s before querying",
    async (archived) => {
      await request(app.getHttpServer())
        .get("/api/assistant/threads")
        .query({ archived })
        .expect(400);
      expect(listThreads).not.toHaveBeenCalled();
    },
  );
  it("exposes persisted activity through the existing thread snapshot", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/assistant/threads/8a44eae9-76c2-425c-baa5-443b9688f4d0")
      .expect(200);
    expect(response.body.data.latestRun.activity).toBe("searching");
  });
});
