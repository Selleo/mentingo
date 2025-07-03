import { createRemixStub } from "@remix-run/testing";
import { screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import ProfilePage from "~/modules/Profile/Profile.page";
import { renderWith } from "~/utils/testUtils";

// import { useUserDetails } from "~/api/queries/useUserDetails";
// import { useTeacherCourses } from "~/api/queries/useTeacherCourses";
// import { isAdminLike } from "~/utils/userRoles";

vi.mock("~/api/queries/useUserDetails", () => ({
  useUserDetails: vi.fn(),
}));

vi.mock("~/api/queries/useTeacherCourses", () => ({
  useTeacherCourses: vi.fn(),
}));

vi.mock("~/utils/userRoles", () => ({
  isAdminLike: vi.fn(),
}));

const RemixStub = createRemixStub([{ path: "/profile/uuid", Component: ProfilePage }]);

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.skip("renders and shows user details when present", () => {
    // (useUserDetails as vi.Mock).mockReturnValue({
    //   data: {
    //     firstName: "John",
    //     lastName: "Doe",
    //     contactEmail: "john@example.com",
    //     jobTitle: "Content Creator",
    //     description: "About John",
    //     contactPhone: "123456789",
    //     role: "teacher",
    //   },
    //   isLoading: false,
    // });

    // (useTeacherCourses as vi.Mock)
    //   .mockReturnedValue({ data: [] })(isAdminLike as vi.Mock)
    //   .mockReturnValue(true);

    renderWith({ withQuery: true }).render(<RemixStub initialEntries={["/profile/uuid"]} />);
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("About John")).toBeInTheDocument();
  });

  it("redirect if no user details", () => {
    renderWith({ withQuery: true }).render(<RemixStub />);
  });
});
