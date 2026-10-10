import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "./drawer";

const originalSetPointerCapture = Element.prototype.setPointerCapture;
const originalReleasePointerCapture = Element.prototype.releasePointerCapture;

beforeAll(() => {
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

afterAll(() => {
  Element.prototype.setPointerCapture = originalSetPointerCapture;
  Element.prototype.releasePointerCapture = originalReleasePointerCapture;
});

describe("authoring-compatible DrawerContent mounting", () => {
  it("keeps open content interactive, dismisses outside, and can reopen", async () => {
    const user = userEvent.setup();

    const ControlledDrawer = () => {
      const [open, setOpen] = useState(true);

      return (
        <>
          <button type="button" data-testid="curriculum">
            Curriculum
          </button>
          <button type="button" data-testid="reopen" onClick={() => setOpen(true)}>
            Reopen
          </button>
          <span data-testid="drawer-state">{open ? "open" : "closed"}</span>
          <Drawer open={open} modal={open} onOpenChange={setOpen} shouldScaleBackground={false}>
            <DrawerContent
              forceMount
              renderOverlay={open}
              aria-hidden={!open}
              style={{ transform: "translate3d(0,0,0)" }}
              overlayClassName="z-[49]"
              className={!open ? "pointer-events-none invisible" : undefined}
            >
              <DrawerTitle>Authoring</DrawerTitle>
              <DrawerDescription>Authoring runtime</DrawerDescription>
              <input aria-label="Authoring input" data-testid="authoring-input" />
            </DrawerContent>
          </Drawer>
        </>
      );
    };

    renderWith().render(<ControlledDrawer />);
    const input = screen.getByTestId("authoring-input");

    await user.click(input);
    await user.type(input, "hello");
    expect(input).toHaveValue("hello");
    expect(screen.getByTestId("drawer-state")).toHaveTextContent("open");

    const overlay = document.querySelector("[data-vaul-overlay]");
    expect(overlay).not.toBeNull();
    await user.click(overlay as HTMLElement);
    await waitFor(() => expect(screen.getByTestId("drawer-state")).toHaveTextContent("closed"));

    await user.click(screen.getByTestId("curriculum"));
    expect(screen.getByTestId("curriculum")).toBeInTheDocument();
    await user.click(screen.getByTestId("reopen"));
    await user.click(input);
    await user.type(input, " again");
    expect(input).toHaveValue("hello again");
    expect(screen.getByTestId("drawer-state")).toHaveTextContent("open");
  });

  it("keeps forced content mounted while releasing the closed modal and overlay", async () => {
    const user = userEvent.setup();
    const onCurriculumClick = vi.fn();
    const view = renderWith().render(
      <>
        <button type="button" data-testid="curriculum" onClick={onCurriculumClick}>
          Curriculum
        </button>
        <Drawer open modal shouldScaleBackground={false}>
          <DrawerContent forceMount renderOverlay aria-hidden={false}>
            <DrawerTitle>Authoring</DrawerTitle>
            <DrawerDescription>Authoring runtime</DrawerDescription>
            <div data-testid="authoring-runtime">Authoring runtime</div>
          </DrawerContent>
        </Drawer>
      </>,
    );

    view.rerender(
      <>
        <button type="button" data-testid="curriculum" onClick={onCurriculumClick}>
          Curriculum
        </button>
        <Drawer open={false} modal={false} shouldScaleBackground={false}>
          <DrawerContent forceMount renderOverlay={false} aria-hidden>
            <DrawerTitle>Authoring</DrawerTitle>
            <DrawerDescription>Authoring runtime</DrawerDescription>
            <div data-testid="authoring-runtime">Authoring runtime</div>
          </DrawerContent>
        </Drawer>
      </>,
    );

    expect(screen.getByTestId("authoring-runtime")).toBeInTheDocument();
    expect(screen.getByTestId("authoring-runtime").closest('[aria-hidden="true"]')).toBeTruthy();
    await waitFor(() => expect(document.querySelector("[data-vaul-overlay]")).toBeNull());
    await waitFor(() => expect(document.body.style.pointerEvents).toBe("auto"));

    await user.click(screen.getByTestId("curriculum"));
    expect(onCurriculumClick).toHaveBeenCalledOnce();
  });
});
