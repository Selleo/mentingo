import { createRemixStub } from "@remix-run/testing";
import { DISCUSSION_SCOPES } from "@repo/shared";
import { screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { ForumTopicListItem } from "./ForumTopicListItem";

const AUTHOR_NAME = "Ada Author";

const renderItem = (isDeleted: boolean) => {
  const RemixStub = createRemixStub([
    {
      path: "/",
      Component: () => (
        <ForumTopicListItem
          topic={{
            id: "topic-1",
            scope: DISCUSSION_SCOPES.GENERAL,
            title: "Exam preparation",
            course: null,
            author: { id: "user-1", firstName: "Ada", lastName: "Author", avatarReference: null },
            replyCount: 2,
            lastActivityAt: "2026-11-01T10:00:00.000Z",
            createdAt: "2026-11-01T10:00:00.000Z",
            excerpt: isDeleted ? "" : "Who wants to study together?",
            isDeleted,
          }}
        />
      ),
    },
  ]);

  return renderWith().render(<RemixStub />);
};

it("shows the author of a topic", async () => {
  renderItem(false);

  expect(await screen.findByText(AUTHOR_NAME)).toBeInTheDocument();
});

it("hides the author once the first post is deleted", async () => {
  renderItem(true);

  expect(await screen.findByText("Exam preparation")).toBeInTheDocument();
  expect(screen.queryByText(AUTHOR_NAME)).not.toBeInTheDocument();
});
