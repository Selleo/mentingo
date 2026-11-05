import { PERMISSIONS, type PermissionKey } from "@repo/shared";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { CoursePreviewNotice } from "./CoursePreviewNotice";

const state = vi.hoisted(() => ({
  preview: true,
  permissions: [] as PermissionKey[],
  status: "published",
  enrolled: false,
  priceInCents: 0,
  enroll: vi.fn(),
  toggleLearningMode: vi.fn(),
}));

vi.mock("~/api/mutations", () => ({
  useEnrollCourse: () => ({ mutate: state.enroll, isPending: false }),
  useToggleCourseStudentMode: () => ({ mutate: state.toggleLearningMode, isPending: false }),
}));
vi.mock("~/api/queries", () => ({
  useCurrentUser: () => ({ data: { id: "viewer-1", permissions: state.permissions } }),
}));
vi.mock("~/hooks/useIsRegistrationEnabled", () => ({
  useIsRegistrationEnabled: () => true,
}));
vi.mock("~/modules/stripe/PaymentModal", () => ({
  PaymentModal: () => <button>Checkout</button>,
}));
vi.mock("~/modules/Courses/context/CourseAccessProvider", () => ({
  useCourseAccessProvider: () => ({
    course: {
      id: "course-1",
      status: state.status,
      enrolled: state.enrolled,
      priceInCents: state.priceInCents,
      currency: "USD",
      stripePriceId: "price-1",
    },
    isPreviewMode: state.preview,
  }),
}));

const renderNotice = () =>
  renderWith().render(
    <MemoryRouter>
      <CoursePreviewNotice />
    </MemoryRouter>,
  );

describe("CoursePreviewNotice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.preview = true;
    state.permissions = [PERMISSIONS.LEARNING_PROGRESS_UPDATE];
    state.status = "published";
    state.enrolled = false;
    state.priceInCents = 0;
  });

  it("explains enrollment requirements and enrolls the learner in the current course", async () => {
    renderNotice();

    expect(screen.getByText(/Enroll to take quizzes/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Enroll to the course" }));

    expect(state.enroll).toHaveBeenCalledWith({ id: "course-1" });
    expect(state.toggleLearningMode).not.toHaveBeenCalled();
  });

  it("offers admins a working Learn mode action instead of enrollment", async () => {
    state.permissions.push(PERMISSIONS.LEARNING_MODE_USE);
    renderNotice();

    expect(screen.getByText(/Enable Learn mode/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /learning mode/i }));

    expect(state.toggleLearningMode).toHaveBeenCalledWith({ enabled: true });
    expect(state.enroll).not.toHaveBeenCalled();
  });

  it("uses checkout for a paid course rather than free enrollment", async () => {
    state.priceInCents = 1200;
    renderNotice();

    expect(screen.getByRole("button", { name: "Checkout" })).toBeInTheDocument();
    expect(state.enroll).not.toHaveBeenCalled();
  });

  it("does not enable Learn mode for a draft", () => {
    state.permissions.push(PERMISSIONS.LEARNING_MODE_USE);
    state.status = "draft";
    renderNotice();

    expect(screen.getByRole("button", { name: /learning mode/i })).toBeDisabled();
  });

  it("hides the notice during active learning", () => {
    state.preview = false;
    renderNotice();

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
});
