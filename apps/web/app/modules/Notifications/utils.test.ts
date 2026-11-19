import { ANNOUNCEMENT_SOURCE_TYPES } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { getNotificationHref } from "./utils";

import type { NotificationAnnouncement } from "./notifications.types";

const buildAnnouncement = (overrides: Partial<NotificationAnnouncement>) =>
  ({
    sourceType: ANNOUNCEMENT_SOURCE_TYPES.MANUAL,
    sourceId: null,
    ...overrides,
  }) as NotificationAnnouncement;

describe("getNotificationHref", () => {
  it("links a forum mention to its topic", () => {
    expect(
      getNotificationHref(
        buildAnnouncement({ sourceType: ANNOUNCEMENT_SOURCE_TYPES.FORUM, sourceId: "topic-1" }),
      ),
    ).toBe("/forum/topics/topic-1");
  });

  it("links a course discussion mention to its course", () => {
    expect(
      getNotificationHref(
        buildAnnouncement({
          sourceType: ANNOUNCEMENT_SOURCE_TYPES.COURSE_CHAT,
          sourceId: "course-1",
        }),
      ),
    ).toBe("/course/course-1");
  });

  it("prefers the link stored with the notification, such as a discussion thread", () => {
    expect(
      getNotificationHref(
        buildAnnouncement({
          sourceType: ANNOUNCEMENT_SOURCE_TYPES.COURSE_CHAT,
          sourceId: "course-1",
          linkPath: "/course/course-1?tab=Discussion&thread=message-1",
        }),
      ),
    ).toBe("/course/course-1?tab=Discussion&thread=message-1");
  });

  it.each(["https://example.com/forum", "//example.com/forum", "/\\example.com/forum"])(
    "ignores the stored link %s, which leaves the application",
    (linkPath) => {
      expect(
        getNotificationHref(
          buildAnnouncement({
            sourceType: ANNOUNCEMENT_SOURCE_TYPES.FORUM,
            sourceId: "topic-1",
            linkPath,
          }),
        ),
      ).toBe("/forum/topics/topic-1");
    },
  );

  it("gives manual announcements no link", () => {
    expect(getNotificationHref(buildAnnouncement({}))).toBeNull();
  });
});
