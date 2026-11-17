import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SkipToContentLink } from "./SkipToContentLink";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe("SkipToContentLink", () => {
  it("is the first Tab stop and moves focus to the main content", async () => {
    const user = userEvent.setup();

    render(
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
    const skipLink = screen.getByRole("link", { name: "navigationSideBar.skipToContent" });

    expect(skipLink).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByRole("main")).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
  });
});
