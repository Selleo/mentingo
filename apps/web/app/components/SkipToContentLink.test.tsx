import { fireEvent, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { SkipToContentLink } from "./SkipToContentLink";

describe("SkipToContentLink", () => {
  it("is the first Tab stop and moves focus to the main content", async () => {
    const user = userEvent.setup();

    renderWith().render(
      <>
        <SkipToContentLink />
        <nav>
          <a href="/courses">Courses</a>
        </nav>
        <main>
          <button type="button">Next</button>
        </main>
      </>,
    );

    await user.tab();

    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveFocus();

    await user.keyboard("{Enter}");

    const main = screen.getByRole("main");

    expect(main).toHaveFocus();

    await user.tab();

    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
    expect(main).not.toHaveAttribute("tabindex");
  });

  it("does not follow the link when the page has no main content", () => {
    renderWith().render(<SkipToContentLink />);

    const isFollowed = fireEvent.click(screen.getByRole("link", { name: "Skip to content" }));

    expect(isFollowed).toBe(false);
    expect(window.location.hash).toBe("");
  });
});
