import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Accordion } from "~/components/ui/accordion";
import { renderWith } from "~/utils/testUtils";

import { ActivityLogTimelineItem } from "./ActivityLogTimelineItem";

import type { ActivityLogItem } from "../activityLogs.utils";

const activityLog: ActivityLogItem = {
  id: "11111111-1111-4111-8111-111111111111",
  createdAt: "2026-08-13T12:00:00.000Z",
  updatedAt: "2026-08-13T12:00:00.000Z",
  actorId: "22222222-2222-4222-8222-222222222222",
  actorEmail: "admin@example.com",
  actorRole: "admin",
  actionType: "enroll_course",
  resourceType: "course",
  resourceId: "33333333-3333-4333-8333-333333333333",
  resourceName: "Safety onboarding",
  metadata: null,
};

const renderItem = (item: ActivityLogItem) =>
  renderWith().render(
    <Accordion type="single" value={item.id}>
      <ActivityLogTimelineItem item={item} />
    </Accordion>,
  );

describe("ActivityLogTimelineItem", () => {
  it("shows the resolved resource name and ID for metadata-free activity", () => {
    renderItem(activityLog);

    expect(screen.getByText("Safety onboarding")).toBeVisible();
    expect(screen.getByText(activityLog.resourceId as string)).toBeVisible();
    expect(screen.getByText("No metadata available.")).toBeVisible();
  });

  it("shows the resource-name fallback when resolution fails", () => {
    renderItem({ ...activityLog, resourceName: null });

    expect(screen.getByText("Name unavailable")).toBeVisible();
  });
});
