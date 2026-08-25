import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { MentionTextarea } from "./MentionTextarea";

describe("MentionTextarea", () => {
  it("renders the mention picker with CSS positioning", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    renderWith().render(
      <div className="overflow-y-auto">
        <MentionTextarea
          value="@men"
          onChange={onChange}
          users={[
            {
              id: "user-1",
              firstName: "Mention",
              lastName: "Target",
              avatarReference: null,
              isOnline: false,
            },
          ]}
          placeholder="Write a message"
          maxLength={5000}
          testIds={{ mentionList: "mention-list", mentionOption: (id) => `mention-${id}` }}
        />
      </div>,
    );

    const picker = await screen.findByTestId("mention-list");

    expect(picker.parentElement).not.toBe(document.body);
    expect(picker).toHaveClass("absolute");

    await user.click(screen.getByTestId("mention-user-1"));

    expect(onChange).toHaveBeenCalledWith("@Mention Target ");
  });
});
