import { useNavigate } from "@remix-run/react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { useAutomationExitGuard } from "./useAutomationExitGuard";

function Editor() {
  const [dirty, setDirty] = useState(true);
  const navigate = useNavigate();
  const { blocker, navigateAfterSave } = useAutomationExitGuard(dirty);

  return (
    <>
      <button onClick={() => navigate("/list")}>Back</button>
      <button
        onClick={() => {
          setDirty(false);
          navigateAfterSave("/created");
        }}
      >
        Save
      </button>
      <button onClick={() => setDirty(false)}>Apply</button>
      {blocker.state === "blocked" && (
        <>
          <button onClick={() => blocker.reset()}>Stay</button>
          <button onClick={() => blocker.proceed()}>Discard</button>
          <button
            onClick={() => {
              setDirty(false);
              blocker.proceed();
            }}
          >
            Save and leave
          </button>
        </>
      )}
    </>
  );
}

function setup() {
  const router = createMemoryRouter(
    [
      { path: "/list", element: <p>List</p> },
      { path: "/edit", element: <Editor /> },
      { path: "/created", element: <p>Created</p> },
    ],
    { initialEntries: ["/list", "/edit"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("Automation exit guard", () => {
  it("blocks browser Back, permits staying, and resumes the original destination", async () => {
    const router = setup();
    await act(async () => {
      await router.navigate(-1);
    });
    fireEvent.click(await screen.findByText("Stay"));
    expect(router.state.location.pathname).toBe("/edit");
    await act(async () => {
      await router.navigate(-1);
    });
    fireEvent.click(await screen.findByText("Discard"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/list"));
  });

  it("guards route navigation and allows save and leave", async () => {
    const router = setup();
    fireEvent.click(screen.getByText("Back"));
    expect(router.state.location.pathname).toBe("/edit");
    fireEvent.click(await screen.findByText("Save and leave"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/list"));
  });

  it("allows navigation immediately after saving a newly created automation", async () => {
    const router = setup();
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/created"));
    expect(screen.queryByText("Stay")).toBeNull();
  });

  it("warns on reload only while changes are unsaved", () => {
    setup();
    const unsaved = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unsaved);
    expect(unsaved.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByText("Apply"));
    const saved = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(saved);
    expect(saved.defaultPrevented).toBe(false);
  });
});
