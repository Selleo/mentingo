import { createRemixStub } from "@remix-run/testing";
import { screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import ProfilePage from "~/modules/Profile/Profile.page";
import { renderWith } from "~/utils/testUtils";

vi.mock("~/api/queries/useContentCreatorCourses", () => ({
  useContentCreatorCourses: vi.fn().mockReturnValue({ data: [] }),
}));

vi.mock("~/utils/userRoles", () => ({
  isAdminLike: vi.fn().mockReturnValue(false),
}));

vi.mock("~/api/queries/useCurrentUser", async () => {
  const actual = await vi.importActual("~/api/queries/useCurrentUser");

  return {
    ...actual,
    useCurrentUserSuspense: vi.fn().mockReturnValue({ id: "1234" }),
  };
});

const RemixStub = createRemixStub([{ path: "/profile/:id", Component: ProfilePage }]);

describe("ProfilePage", () => {
  it("renders and shows user details when present", async () => {
    renderWith({ withQuery: true }).render(<RemixStub initialEntries={["/profile/1234"]} />);
    const text = await screen.findAllByText("John Doe");
    expect(text.length).toBeGreaterThan(0);
  });

  it("redirect if forbidden", () => {
    renderWith({ withQuery: true }).render(<RemixStub initialEntries={["/profile/5678"]} />);
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
  });
});
