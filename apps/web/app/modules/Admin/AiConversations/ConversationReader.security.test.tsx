import { createRemixStub } from "@remix-run/testing";
import { AI_THREAD_TYPES } from "@repo/shared";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { AI_CONVERSATIONS_HANDLES } from "../../../../e2e/data/ai-conversations/handles";

import { ConversationReader } from "./ConversationReader";

const state = vi.hoisted(() => ({ type: "assistant", role: "assistant", content: "" }));
vi.mock("~/api/queries", () => ({
  useCurrentUserSuspense: () => ({
    data: { firstName: "Admin", lastName: "Reviewer", profilePictureUrl: null },
  }),
}));
vi.mock("~/api/queries/admin/useAdminAiThread", () => ({
  useAdminAiThread: () => ({
    data: {
      id: "thread",
      title: "Saved conversation",
      type: state.type,
      owner: { firstName: "Alex", lastName: "Learner", profilePictureUrl: null },
      status: "active",
      language: "en",
      courseTitle: null,
      evaluation: null,
      createdAt: "2026-09-10T10:00:00Z",
      lastActivityAt: "2026-09-10T10:05:00Z",
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("~/api/queries/admin/useAdminAiThreadMessages", () => ({
  useAdminAiThreadMessages: () => ({
    data: {
      pages: [
        {
          data: [
            {
              id: "message",
              role: state.role,
              content: state.content,
              status: "complete",
              createdAt: "2026-09-10T10:00:00Z",
            },
          ],
        },
      ],
    },
    isPending: false,
    isError: false,
    hasNextPage: false,
  }),
}));
const Page = createRemixStub([
  { path: "/", Component: () => <ConversationReader threadId="thread" language="en" search="" /> },
]);

beforeEach(() => {
  state.type = AI_THREAD_TYPES.ASSISTANT;
  state.role = "assistant";
  state.content = "";
});

describe("admin Assistant transcript rendering", () => {
  it.each(["assistant", "user"])(
    "never loads inline or reference tracking images from %s messages",
    async (role) => {
      state.role = role;
      state.content =
        "![inline](https://attacker.invalid/inline)\n\n![preview][p]\n\n[p]: //attacker.invalid/pixel";
      const { container } = renderWith().render(<Page />);
      await screen.findByText("Saved conversation");
      expect(container.querySelector("img, iframe, picture, source")).toBeNull();
      expect(screen.getByTestId(AI_CONVERSATIONS_HANDLES.MESSAGE)).toHaveTextContent("preview");
    },
  );

  it("renders unverified internal/external/reference/unsafe links as labels and never interprets raw HTML", async () => {
    state.content =
      '[internal](/course/unknown) [external](http://attacker.invalid) [relative](//attacker.invalid) [unsafe](javascript:alert%281%29)\n\n[reference][r]\n\n[r]: https://attacker.invalid\n\n<img src="//attacker.invalid/pixel"><script>alert(1)</script>';
    const { container } = renderWith().render(<Page />);
    await screen.findByText("Saved conversation");
    for (const label of ["internal", "external", "relative", "unsafe", "reference"]) {
      expect(screen.getByText(label).closest("a")).toBeNull();
    }
    expect(container.querySelector("img, iframe, script")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1); // Only the trusted navigation back link.
  });

  it("keeps learner messages as literal text rather than interpreting Markdown or HTML", async () => {
    state.role = "user";
    state.content = '[external](https://attacker.invalid) <img src="//attacker.invalid/pixel">';
    const { container } = renderWith().render(<Page />);
    expect(await screen.findByText(state.content)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it.each([AI_THREAD_TYPES.AI_MENTOR, AI_THREAD_TYPES.PRACTICE])(
    "preserves existing generic Markdown for legacy %s bot transcripts",
    async (type) => {
      state.type = type;
      state.content =
        "[legacy link](https://example.org) ![legacy image](https://example.org/image.png)";
      renderWith().render(<Page />);
      expect(await screen.findByRole("link", { name: "legacy link" })).toHaveAttribute(
        "href",
        "https://example.org",
      );
      expect(screen.getByRole("img", { name: "legacy image" })).toHaveAttribute(
        "src",
        "https://example.org/image.png",
      );
    },
  );
});
