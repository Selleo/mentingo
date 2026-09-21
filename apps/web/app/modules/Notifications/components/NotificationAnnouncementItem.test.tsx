import { createRemixStub } from "@remix-run/testing";
import {
  ANNOUNCEMENT_SOURCE_TYPES,
  ANNOUNCEMENT_STATUSES,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "~/components/ui/tooltip";
import { renderWith } from "~/utils/testUtils";

import { NotificationAnnouncementItem } from "./NotificationAnnouncementItem";

import type { NotificationAnnouncement } from "../notifications.types";

const markAsRead = vi.fn();
const parentClick = vi.fn();

vi.mock("~/api/mutations/useMarkAnnouncementAsRead", () => ({
  useMarkAnnouncementAsRead: () => ({ mutate: markAsRead, isPending: false }),
}));

vi.mock("~/api/mutations/admin/useDeleteAnnouncement", () => ({
  useDeleteAnnouncement: () => ({ mutate: vi.fn(), isPending: false }),
}));

const courseId = "11111111-1111-4111-8111-111111111111";
const announcement: NotificationAnnouncement = {
  id: "22222222-2222-4222-8222-222222222222",
  createdAt: "2026-09-08T08:00:00.000Z",
  updatedAt: "2026-09-08T08:00:00.000Z",
  authorId: "33333333-3333-4333-8333-333333333333",
  audience: "selected_users",
  status: ANNOUNCEMENT_STATUSES.PUBLISHED,
  scheduledAt: null,
  publishedAt: null,
  sendEmail: false,
  emailTemplate: "default",
  sourceType: ANNOUNCEMENT_SOURCE_TYPES.COURSE_CHAT,
  sourceId: courseId,
  title: "You were mentioned",
  content: 'In the course "Safety"',
  baseLanguage: SUPPORTED_LANGUAGES.EN,
  availableLocales: [SUPPORTED_LANGUAGES.EN],
  deletedAt: null,
  isRead: false,
};

const renderItem = (item: NotificationAnnouncement) => {
  const RemixStub = createRemixStub([
    {
      path: "/",
      Component: () => (
        <TooltipProvider>
          <div role="button" tabIndex={0} onClick={parentClick} onKeyDown={vi.fn()}>
            <NotificationAnnouncementItem announcement={item} canDelete={false} />
          </div>
        </TooltipProvider>
      ),
    },
    { path: "/course/:courseId", Component: () => null },
  ]);

  return renderWith().render(<RemixStub />);
};

describe("NotificationAnnouncementItem", () => {
  beforeEach(() => {
    markAsRead.mockClear();
    parentClick.mockClear();
  });

  it("links the course notification without marking it read or propagating the click", () => {
    renderItem(announcement);

    const link = screen.getByRole("link", { name: /You were mentioned/i });
    expect(link).toHaveAttribute("href", `/course/${courseId}`);

    fireEvent.click(link);
    expect(markAsRead).not.toHaveBeenCalled();
    expect(parentClick).not.toHaveBeenCalled();
  });

  it("does not link a manual announcement", () => {
    renderItem({
      ...announcement,
      sourceType: ANNOUNCEMENT_SOURCE_TYPES.MANUAL,
      sourceId: null,
      content: "A manual announcement",
    });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
