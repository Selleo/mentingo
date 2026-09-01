import { LEARNER_TRANSCRIPT_STATUSES } from "@repo/shared";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { VoiceConversationTranscript } from "./VoiceConversationTranscript";

vi.mock("~/api/queries", () => ({
  useCurrentUserSuspense: vi.fn(() => ({
    data: {
      firstName: "Kaylah",
      lastName: "Admin",
      profilePictureUrl: "https://example.com/kaylah.png",
    },
  })),
}));

describe("VoiceConversationTranscript", () => {
  it("keeps learner messages on the left with the mentor conversation", () => {
    renderWith().render(
      <VoiceConversationTranscript
        learnerTranscript={{
          text: "I would like a discount",
          turnId: "turn-1",
          segmentId: "segment-1",
          revision: 1,
          status: LEARNER_TRANSCRIPT_STATUSES.FINAL,
        }}
        mentorResponse="How can I help?"
        mentorSpeech={null}
        mentorName="Mentor"
      />,
    );

    const learnerMessage = screen.getByText("I would like a discount").parentElement;
    const learnerRow = learnerMessage?.parentElement?.parentElement;
    const learnerAvatar = screen.getByText("Kaylah Admin").parentElement?.previousElementSibling;

    expect(screen.getByText("Kaylah Admin")).toBeInTheDocument();
    expect(screen.getByText("Mentor")).toBeInTheDocument();
    expect(learnerAvatar).toHaveClass("mt-0.5", "shrink-0");
    expect(learnerAvatar?.querySelector(".size-9")).toBeInTheDocument();
    expect(learnerRow).toHaveClass("self-start");
    expect(learnerMessage).toHaveClass("rounded-bl-md");
    expect(learnerMessage).not.toHaveClass("ml-auto", "rounded-br-md");
  });
});
