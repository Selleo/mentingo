import { createRemixStub } from "@remix-run/testing";
import { screen } from "@testing-library/react";
import { describe, it, expect, vi, type Mock } from "vitest";

import { useContentCreatorCourses } from "~/api/queries/useContentCreatorCourses";
import { useUserDetails } from "~/api/queries/useUserDetails";
import ProfilePage from "~/modules/Profile/Profile.page";
import { renderWith } from "~/utils/testUtils";
import { isAdminLike } from "~/utils/userRoles";

vi.mock("~/api/queries/useUserDetails", () => ({
  useUserDetails: vi.fn(),
}));

vi.mock("~/api/queries/useContentCreatorCourses", () => ({
  useContentCreatorCourses: vi.fn(),
}));

vi.mock("~/utils/userRoles", () => ({
  isAdminLike: vi.fn(),
}));

const RemixStub = createRemixStub([{ path: "/profile/:id", Component: ProfilePage }]);

const fakeUserDetails = {
  data: {
    firstName: "John",
    lastName: "Doe",
    contactEmail: "john@example.com",
    contactPhone: "123456789",
    jobTitle: "Content Creator",
    description: "About John",
    role: "teacher",
  },
  error: false,
};

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders and shows user details when present", () => {
    (useUserDetails as Mock).mockReturnValue(fakeUserDetails);
    (useContentCreatorCourses as Mock).mockReturnValue({ data: [] });
    (isAdminLike as Mock).mockReturnValue(false);

    renderWith({ withQuery: true }).render(<RemixStub initialEntries={["/profile/uuid"]} />);
    expect(screen.getAllByText("John Doe").length).toBeGreaterThan(0);
  });

  it("redirect if forbidden", () => {
    (useUserDetails as Mock).mockReturnValue({ data: undefined, error: true });
    (useContentCreatorCourses as Mock).mockReturnValue({ data: [] });
    (isAdminLike as Mock).mockReturnValue(false);

    renderWith({ withQuery: true }).render(<RemixStub initialEntries={["/profile/uuid"]} />);
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
  });
});
