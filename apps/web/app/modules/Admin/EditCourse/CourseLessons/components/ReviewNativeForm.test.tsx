import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";

import { ReadOnlyFrame } from "./ReadOnlyFrame";

describe("ReadOnlyFrame", () => {
  it("allows marked preview file links while blocking ordinary controls", async () => {
    const openFile = vi.fn();
    const blocked = vi.fn();
    render(
      <ReadOnlyFrame>
        <a
          href="blob:diagram"
          data-read-only-allow
          onClick={(event) => {
            event.preventDefault();
            openFile();
          }}
        >
          Open diagram
        </a>
        <button type="button" onClick={blocked}>
          Apply
        </button>
      </ReadOnlyFrame>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("link", { name: "Open diagram" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(openFile).toHaveBeenCalledOnce();
    expect(blocked).not.toHaveBeenCalled();
  });

  it("blocks an option-delete icon handler while allowing question expansion", async () => {
    const removeOption = vi.fn();
    const expandQuestion = vi.fn();
    render(
      <ReadOnlyFrame>
        <svg role="img" aria-label="Remove option" onClick={removeOption} />
        <button
          type="button"
          aria-expanded="false"
          aria-controls="question-panel"
          onClick={expandQuestion}
        >
          Question
        </button>
      </ReadOnlyFrame>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("img", { name: "Remove option" }));
    expect(removeOption).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Question" }));
    expect(expandQuestion).toHaveBeenCalledOnce();
  });

  it("keeps marked view buttons usable and leaves portalled dialogs to guard themselves", async () => {
    const openDetails = vi.fn();
    const closeDialog = vi.fn();
    render(
      <ReadOnlyFrame>
        <button type="button" data-read-only-allow onClick={openDetails}>
          Review configuration
        </button>
        {createPortal(
          <button type="button" onClick={closeDialog}>
            Close
          </button>,
          document.body,
        )}
      </ReadOnlyFrame>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Review configuration" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(openDetails).toHaveBeenCalledOnce();
    expect(closeDialog).toHaveBeenCalledOnce();
  });
});
