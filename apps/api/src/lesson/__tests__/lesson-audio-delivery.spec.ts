import { EventEmitter, once } from "node:events";
import { Readable, Writable } from "node:stream";

import { PERMISSIONS } from "@repo/shared";

import { LessonService } from "../services/lesson.service";

import type { Request, Response } from "express";
import type { CurrentUserType } from "src/common/types/current-user.type";

describe("authorized lesson audio delivery", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const user = {
    userId: id,
    tenantId: id,
    permissions: [PERMISSIONS.COURSE_READ],
  } as CurrentUserType;
  const resource = {
    id,
    tenantId: id,
    reference: `${id}/audio.mp3`,
    contentType: "audio/mpeg",
    entityId: id,
    entityType: "lesson",
    uploadedBy: id,
  };
  const relation = {
    lessonId: id,
    authorId: "other",
    status: "published",
    isArchived: false,
    isFreemium: false,
    isEnrolled: true,
  };
  const req = { headers: { range: "bytes=1-3" } } as Request;
  const res = { setHeader: jest.fn() } as unknown as Response;
  let repository: {
    getResource: jest.Mock;
    getAudioResourceLessons: jest.Mock;
    getHasLessonAccess: jest.Mock;
    checkLessonAssignment: jest.Mock;
    getHasPublicContentResourceAccess: jest.Mock;
  };
  let streamResource: jest.Mock;
  let service: LessonService;
  beforeEach(() => {
    repository = {
      getResource: jest.fn(async () => resource),
      getAudioResourceLessons: jest.fn(async () => [relation]),
      getHasLessonAccess: jest.fn(async () => true),
      checkLessonAssignment: jest.fn(async () => [{ isAssigned: true }]),
      getHasPublicContentResourceAccess: jest.fn(async () => true),
    };
    streamResource = jest.fn();
    service = Object.assign(Object.create(LessonService.prototype), {
      lessonRepository: repository,
      streamResource,
    }) as LessonService;
  });
  it("does not classify a mixed video/audio lesson as video-only or add audio to video progression", async () => {
    const lesson = {
      description:
        '<p>Introduction</p><div data-node-type="video" data-autoplay="no_autoplay" data-src="https://video.example/movie"></div><div data-node-type="audio" data-autoplay="autoplay" data-src="/api/lesson/lesson-resource/11111111-1111-4111-8111-111111111111"></div>',
    };
    // Supply the audio resource so missing-relation repair is not part of this rendering test.
    Object.assign(service, {
      hostedVideoStatusService: {
        findProcessingStatusesInCurrentTenant: jest.fn(async () => new Map()),
      },
      fileService: {
        getResourcesForEntity: jest.fn(async () => [
          { id, contentType: "audio/mpeg", fileUrl: "signed" },
        ]),
      },
    });
    const result = await service["getContentLessonWithResources"](lesson as never, id, "en");
    expect(result.hasOnlyVideo).toBe(false);
    expect(result.hasTrackedVideo).toBe(false);
    expect(result.hasAutoplayTrigger).toBe(false);
    expect(result.videos).toEqual(["https://video.example/movie"]);
  });

  it("forwards authenticated audio ranges and emits a seekable 206 response", async () => {
    const headers = new Map<string, string>();
    let status = 0;
    let body = "";
    const response = Object.assign(
      new Writable({
        write(chunk, _encoding, done) {
          body += chunk.toString();
          done();
        },
      }),
      {
        req: new EventEmitter(),
        setHeader: (name: string, value: string) => headers.set(name, value),
        status: (code: number) => {
          status = code;
        },
      },
    );
    const getFileDeliveryWithPreview = jest.fn(async () => ({
      type: "stream",
      stream: Readable.from(["bcd"]),
      contentType: "audio/mpeg",
      contentLength: 3,
      contentRange: "bytes 1-3/6",
      acceptRanges: "bytes",
    }));
    const actualService = Object.assign(Object.create(LessonService.prototype), {
      lessonRepository: repository,
      fileService: { getFileDeliveryWithPreview },
    }) as LessonService;
    const finished = once(response, "finish");
    await actualService.getLessonResource(req, response as unknown as Response, user, id);
    await finished;
    expect(getFileDeliveryWithPreview).toHaveBeenCalledWith(resource.reference, {
      contentType: "audio/mpeg",
      preview: undefined,
      range: "bytes=1-3",
    });
    expect(status).toBe(206);
    expect(body).toBe("bcd");
    expect(headers.get("Content-Range")).toBe("bytes 1-3/6");
    expect(headers.get("Content-Length")).toBe("3");
    expect(headers.get("Accept-Ranges")).toBe("bytes");
    expect(headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("requires authentication even for otherwise public freemium content", async () => {
    await expect(service.getLessonResource(req, res, null, id)).rejects.toThrow();
    expect(streamResource).not.toHaveBeenCalled();
  });
  it("does not authorize a resource from another tenant", async () => {
    repository.getResource.mockResolvedValue({ ...resource, tenantId: "other" });
    await expect(service.getLessonResource(req, res, user, id)).rejects.toThrow();
  });
  it.each([
    { ...relation, isEnrolled: false },
    { ...relation, status: "draft" },
    { ...relation, isArchived: true },
  ])("rejects an inaccessible course relationship %j", async (inaccessible) => {
    repository.getAudioResourceLessons.mockResolvedValue([inaccessible]);
    await expect(service.getLessonResource(req, res, user, id)).rejects.toThrow();
    expect(streamResource).not.toHaveBeenCalled();
  });
  it("does not treat manage-own permission as access to another author's course", async () => {
    repository.getAudioResourceLessons.mockResolvedValue([{ ...relation, isEnrolled: false }]);
    await expect(
      service.getLessonResource(
        req,
        res,
        { ...user, permissions: [PERMISSIONS.COURSE_UPDATE_OWN] },
        id,
      ),
    ).rejects.toThrow();
  });
  it("checks sequential lesson availability before streaming to learners", async () => {
    repository.getHasLessonAccess.mockResolvedValue(false);
    await expect(service.getLessonResource(req, res, user, id)).rejects.toThrow();
  });
  it("allows an enrolled learner when any reused resource relationship is accessible", async () => {
    repository.getAudioResourceLessons.mockResolvedValue([
      { ...relation, isEnrolled: false },
      relation,
    ]);
    await service.getLessonResource(req, res, user, id);
    expect(streamResource).toHaveBeenCalledWith(req, res, resource.reference, {
      contentType: "audio/mpeg",
      preview: undefined,
    });
  });
  it("preserves scoped group-manager lesson preview access", async () => {
    repository.getAudioResourceLessons.mockResolvedValue([
      { ...relation, isEnrolled: false, isManagerPreview: true },
    ]);
    await service.getLessonResource(
      req,
      res,
      { ...user, permissions: [PERMISSIONS.MANAGED_GROUP_RESULTS_READ] },
      id,
    );
    expect(streamResource).toHaveBeenCalled();
  });

  it("does not grant a group manager access outside managed course scope", async () => {
    repository.getAudioResourceLessons.mockResolvedValue([
      { ...relation, isEnrolled: false, isManagerPreview: false },
    ]);
    await expect(
      service.getLessonResource(
        req,
        res,
        { ...user, permissions: [PERMISSIONS.MANAGED_GROUP_RESULTS_READ] },
        id,
      ),
    ).rejects.toThrow();
  });

  it("allows the owning author to preview their draft", async () => {
    repository.getAudioResourceLessons.mockResolvedValue([
      { ...relation, status: "draft", authorId: id },
    ]);
    await service.getLessonResource(
      req,
      res,
      { ...user, permissions: [PERMISSIONS.COURSE_UPDATE_OWN] },
      id,
    );
    expect(streamResource).toHaveBeenCalled();
  });
});
