import { DISCUSSION_NOTIFICATION_PREFERENCES } from "@repo/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { renderWith } from "~/utils/testUtils";

import { SETTINGS_PAGE_HANDLES } from "../../../../../e2e/data/settings/handles";

import { DiscussionNotificationPreferences } from "./DiscussionNotificationPreferences";

import type { UserSettings } from "../types";

vi.mock("~/api/api-client", () => ({
  ApiClient: {
    api: {
      settingsControllerUpdateNotificationPreferences: vi.fn(),
      settingsControllerGetUserSettings: vi.fn(),
    },
  },
}));

const { REPLY_EMAILS, REPLY_IN_APP, MENTION_EMAILS } = DISCUSSION_NOTIFICATION_PREFERENCES;

const renderPreferences = (settings: UserSettings) =>
  renderWith().render(
    <QueryClientProvider client={queryClient}>
      <DiscussionNotificationPreferences settings={settings} />
    </QueryClientProvider>,
  );

const switchFor = (preference: string) =>
  screen.getByTestId(SETTINGS_PAGE_HANDLES.discussionNotificationSwitch(preference));

describe("DiscussionNotificationPreferences", () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
    vi.mocked(ApiClient.api.settingsControllerUpdateNotificationPreferences).mockResolvedValue({
      data: { data: { language: "en" } },
    } as never);
  });

  it("shows a preference that was never saved as switched on", () => {
    renderPreferences({ language: "en", [MENTION_EMAILS]: false });

    expect(switchFor(REPLY_IN_APP)).toBeChecked();
    expect(switchFor(REPLY_EMAILS)).toBeChecked();
    expect(switchFor(MENTION_EMAILS)).not.toBeChecked();
  });

  it("saves only the preference that was switched", async () => {
    renderPreferences({ language: "en" });

    fireEvent.click(switchFor(REPLY_EMAILS));

    await waitFor(() =>
      expect(ApiClient.api.settingsControllerUpdateNotificationPreferences).toHaveBeenCalledWith({
        [REPLY_EMAILS]: false,
      }),
    );
  });
});
