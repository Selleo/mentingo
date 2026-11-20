import { createRemixStub } from "@remix-run/testing";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import ProfilePage from "~/modules/Profile/Profile.page";
import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import type { CertificateType } from "~/types/certificate";

const certificate: CertificateType = {
  id: "certificate-1",
  userId: "1234",
  courseTitle: "Safety basics",
  fullName: "John Doe",
  completionDate: "2026-01-15",
  createdAt: "2026-01-15",
};

vi.mock("~/api/queries/useCertificates", () => ({
  useCertificates: () => ({ data: [certificate], isLoading: false, error: null }),
}));

vi.mock("~/api/queries/useContentCreatorCourses", () => ({
  useContentCreatorCourses: vi.fn().mockReturnValue({ data: [] }),
}));

vi.mock("~/hooks/usePermissions", () => ({
  usePermissions: vi.fn().mockReturnValue({
    hasAccess: false,
  }),
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

  const openCertificatePreview = async () => {
    renderWith({ withQuery: true }).render(<RemixStub initialEntries={["/profile/1234"]} />);

    await userEvent.click(await screen.findByRole("button", { name: /Safety basics/ }));

    return screen.findByRole("dialog", { name: "Safety basics" });
  };

  it("opens the certificate preview as a dialog with its own controls and no clickable overlay", async () => {
    const dialog = await openCertificatePreview();

    expect(
      within(dialog).getByRole("button", {
        name: i18next.t("studentCertificateView.button.shareLinkedIn"),
      }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: i18next.t("common.button.close") }),
    ).toBeInTheDocument();
    expect(document.querySelector('[role="button"]')).toBeNull();
  });

  it("closes the certificate preview with Escape", async () => {
    await openCertificatePreview();

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes the certificate preview with its close button", async () => {
    const dialog = await openCertificatePreview();

    await userEvent.click(
      within(dialog).getByRole("button", { name: i18next.t("common.button.close") }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("redirect if forbidden", () => {
    renderWith({ withQuery: true }).render(<RemixStub initialEntries={["/profile/5678"]} />);
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
  });
});
