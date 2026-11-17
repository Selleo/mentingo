import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChatReplyAnnouncer } from "./ChatReplyAnnouncer";

import type { UIMessage } from "@ai-sdk/react";
import type { ChatStatus } from "ai";

const mentorMessage = (id: string, text: string): UIMessage => ({
  id,
  role: "assistant",
  parts: [{ type: "text", text }],
});
const userMessage: UIMessage = {
  id: "user-1",
  role: "user",
  parts: [{ type: "text", text: "Hi" }],
};

const renderAnnouncer = (messages: UIMessage[], status: ChatStatus) => {
  const view = render(<ChatReplyAnnouncer messages={messages} status={status} />);
  const update = (nextMessages: UIMessage[], nextStatus: ChatStatus) =>
    view.rerender(<ChatReplyAnnouncer messages={nextMessages} status={nextStatus} />);

  return { announcer: screen.getByRole("status"), update };
};

describe("ChatReplyAnnouncer", () => {
  it("announces a mentor reply only once it has finished streaming", () => {
    const { announcer, update } = renderAnnouncer([userMessage], "submitted");

    update([userMessage, mentorMessage("reply-1", "Hello, I am")], "streaming");
    expect(announcer).toBeEmptyDOMElement();

    update([userMessage, mentorMessage("reply-1", "Hello, I am your client.")], "ready");
    expect(announcer).toHaveTextContent("Hello, I am your client.");
  });

  it("announces rendered text instead of markdown syntax", () => {
    const { announcer, update } = renderAnnouncer([userMessage], "streaming");

    update([userMessage, mentorMessage("reply-1", "**Bold** point\n\n- first\n- second")], "ready");
    expect(announcer).toHaveTextContent("Bold point");
    expect(announcer).toHaveTextContent("first");
    expect(announcer.textContent).not.toMatch(/[*-]/);
  });

  it("announces each of several consecutive replies", () => {
    const { announcer, update } = renderAnnouncer([userMessage], "streaming");
    const firstReply = mentorMessage("reply-1", "First reply");

    update([userMessage, firstReply], "ready");
    expect(announcer).toHaveTextContent("First reply");

    update([userMessage, firstReply, userMessage], "streaming");
    update(
      [userMessage, firstReply, userMessage, mentorMessage("reply-2", "Second reply")],
      "ready",
    );
    expect(announcer).toHaveTextContent("Second reply");
    expect(announcer).not.toHaveTextContent("First reply");
  });

  it("replaces the announced node when a reply repeats the previous text", () => {
    const { announcer, update } = renderAnnouncer([userMessage], "streaming");
    const firstReply = mentorMessage("reply-1", "Same reply");

    update([userMessage, firstReply], "ready");
    const firstNode = announcer.firstChild;

    update([userMessage, firstReply, userMessage], "streaming");
    update([userMessage, firstReply, userMessage, mentorMessage("reply-2", "Same reply")], "ready");
    expect(announcer).toHaveTextContent("Same reply");
    expect(announcer.firstChild).not.toBe(firstNode);
  });

  it("does not announce partial text when the stream ends in an error", () => {
    const { announcer, update } = renderAnnouncer([userMessage], "streaming");

    update([userMessage, mentorMessage("reply-1", "Partial")], "error");
    expect(announcer).toBeEmptyDOMElement();
  });

  it("does not announce when the user message is last", () => {
    const { announcer, update } = renderAnnouncer([userMessage], "submitted");

    update([userMessage], "ready");
    expect(announcer).toBeEmptyDOMElement();
  });

  it("does not announce again on a rerender without a new reply finishing", () => {
    const { announcer, update } = renderAnnouncer([userMessage], "streaming");

    update([userMessage, mentorMessage("reply-1", "Only once")], "ready");
    const announcedNode = announcer.firstChild;

    update([userMessage, mentorMessage("history-1", "Loaded from history")], "ready");
    expect(announcer).toHaveTextContent("Only once");
    expect(announcer.firstChild).toBe(announcedNode);
  });
});
