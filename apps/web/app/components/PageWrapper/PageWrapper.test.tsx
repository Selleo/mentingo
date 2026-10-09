import { fireEvent, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { UnsavedChangesExitGuard } from "~/modules/Admin/components/UnsavedChangesExitGuard";
import { renderWith } from "~/utils/testUtils";

import { PageWrapper } from "./PageWrapper";

describe("Page breadcrumbs", () => {
  it("uses the app confirmation dialog before leaving an unsaved editor", async () => {
    const router = createMemoryRouter(
      [
        { path: "/templates", element: <p>Template catalog</p> },
        {
          path: "/templates/edit",
          element: (
            <PageWrapper breadcrumbs={[{ title: "Email templates", href: "/templates" }]}>
              <UnsavedChangesExitGuard
                enabled
                dialogTitle="Unsaved changes"
                message="Your changes have not been saved."
                cancelLabel="Keep editing"
                leaveLabel="Leave without saving"
              />
            </PageWrapper>
          ),
        },
      ],
      { initialEntries: ["/templates/edit"] },
    );
    renderWith().render(<RouterProvider router={router} />);

    fireEvent.click(screen.getByRole("link", { name: "Email templates" }));
    expect(await screen.findByRole("dialog", { name: "Unsaved changes" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/templates/edit");
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(router.state.location.pathname).toBe("/templates/edit");

    fireEvent.click(screen.getByRole("link", { name: "Email templates" }));
    fireEvent.click(await screen.findByRole("button", { name: "Leave without saving" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/templates"));
  });
});
