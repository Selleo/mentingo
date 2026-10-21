import { screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { AiMentorPracticeMessages } from "./AiMentorPracticeMessages";

import type { UIMessage } from "@ai-sdk/react";

vi.mock("~/api/queries", () => ({
  useCurrentUserSuspense: () => ({
    data: { firstName: "Maciej", lastName: "Hubert", profilePictureUrl: null },
  }),
}));

describe("AiMentorPracticeMessages", () => {
  it("shows only one mentor identity from waiting through the first text delta to completion", () => {
    const userMessage: UIMessage = {
      id: "user",
      role: "user",
      parts: [{ type: "text", text: "hm nie wiem" }],
    };
    const props = {
      isMessagesLoading: false,
      aiMentorName: "Adam",
      messagesContainerRef: createRef<HTMLDivElement>(),
    };
    const { rerender } = renderWith().render(
      <AiMentorPracticeMessages {...props} messages={[userMessage]} showChatLoader />,
    );
    expect(screen.getAllByText("Adam")).toHaveLength(1);

    for (const parts of [
      [],
      [{ type: "step-start" }],
      [{ type: "reasoning", text: "Thinking" }],
      [{ type: "text", text: "" }],
      [{ type: "text", text: " \n " }],
    ] satisfies UIMessage["parts"][]) {
      rerender(
        <AiMentorPracticeMessages
          {...props}
          messages={[userMessage, { id: "reply", role: "assistant", parts }]}
          showChatLoader
        />,
      );
      expect(screen.getAllByText("Adam")).toHaveLength(1);
      expect(screen.getByText("hm nie wiem")).toBeInTheDocument();
    }

    for (const text of ["Rozumiem", "Rozumiem, spróbujmy ponownie."]) {
      rerender(
        <AiMentorPracticeMessages
          {...props}
          messages={[
            userMessage,
            { id: "reply", role: "assistant", parts: [{ type: "text", text }] },
          ]}
          showChatLoader={false}
        />,
      );
      expect(screen.getAllByText("Adam")).toHaveLength(1);
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });
});
