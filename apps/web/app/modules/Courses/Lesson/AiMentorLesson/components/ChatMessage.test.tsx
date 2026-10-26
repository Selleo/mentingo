import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import ChatMessage from "./ChatMessage";

vi.mock("~/api/queries", () => ({
  useCurrentUserSuspense: vi.fn(() => ({
    data: {
      firstName: "Kaylah",
      lastName: "Admin",
      profilePictureUrl: null,
    },
  })),
}));

describe("ChatMessage", () => {
  it.each([
    { parts: [] },
    { parts: [{ type: "text" as const, text: "" }] },
    { parts: [{ type: "text" as const, text: " \n " }] },
  ])("does not render an empty assistant placeholder with parts $parts", ({ parts }) => {
    renderWith().render(
      <ChatMessage
        id="pending-reply"
        {...{ role: "assistant" as const }}
        aiName="Adam"
        parts={parts}
        testId="pending-reply"
      />,
    );

    expect(screen.queryByTestId("pending-reply")).not.toBeInTheDocument();
    expect(screen.queryByText("Adam")).not.toBeInTheDocument();
  });

  it("keeps custom assistant content without requiring text", () => {
    renderWith().render(
      <ChatMessage
        id="custom-assistant"
        {...{ role: "assistant" as const }}
        aiName="Adam"
        contentNode={<span>Custom reply</span>}
      />,
    );
    expect(screen.getByText("Custom reply")).toBeInTheDocument();
    expect(screen.getByText("Adam")).toBeInTheDocument();
  });

  it("renders an assistant reply supplied through content", () => {
    renderWith().render(
      <ChatMessage
        id="reply"
        {...{ role: "assistant" as const }}
        aiName="Adam"
        content="Odpowiedź mentora"
      />,
    );
    expect(screen.getByText("Odpowiedź mentora")).toBeInTheDocument();
  });

  it("keeps the default user message surface", () => {
    renderWith().render(
      <ChatMessage
        id="default-user-message"
        {...{ role: "user" as const }}
        content="A user message"
        contentTestId="default-user-message-content"
      />,
    );

    const content = screen.getByTestId("default-user-message-content");
    expect(content).toHaveClass("px-4", "py-2", "bg-primary-100");
  });

  it("allows a custom content node to own its user message surface", () => {
    renderWith().render(
      <ChatMessage
        id="custom-user-message"
        {...{ role: "user" as const }}
        contentNodeOwnsSurface
        contentNode={<div className="rounded-xl bg-primary-100 px-4 py-2">Custom bubble</div>}
        contentTestId="custom-user-message-content"
      />,
    );

    const content = screen.getByTestId("custom-user-message-content");
    expect(content).not.toHaveClass("px-4", "py-2", "bg-primary-100");
    expect(content.firstElementChild).toHaveClass("px-4", "py-2", "bg-primary-100");
  });

  it("renders currency dollar signs as text instead of inline math", () => {
    renderWith().render(
      <ChatMessage
        id="currency-message"
        {...{ role: "assistant" as const }}
        aiName="Karen"
        content="I want the $0.50 discount on this $0.70 candy."
        contentTestId="currency-message-content"
      />,
    );

    const message = screen.getByTestId("currency-message-content");

    expect(message).toHaveTextContent("I want the $0.50 discount on this $0.70 candy.");
    expect(message.querySelector(".katex")).not.toBeInTheDocument();
  });

  it("continues to render explicit double-dollar math", () => {
    renderWith().render(
      <ChatMessage
        id="math-message"
        {...{ role: "assistant" as const }}
        aiName="Teacher"
        content="$$x^2$$"
        contentTestId="math-message-content"
      />,
    );

    expect(screen.getByTestId("math-message-content").querySelector(".katex")).toBeInTheDocument();
  });
});
