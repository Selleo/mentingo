import { type ReactNode, type SyntheticEvent, useEffect, useRef } from "react";

import { cn } from "~/lib/utils";

/** Marks a control that stays usable inside a read-only frame, e.g. a "view details" button. */
export const READ_ONLY_ALLOW_ATTRIBUTE = "data-read-only-allow";

const INTERACTIVE_SELECTOR =
  'button, a[href], input, textarea, select, [role="switch"], [role="checkbox"], [role="radio"], [role="option"], [role="button"], [contenteditable="true"], [draggable="true"], [aria-roledescription="sortable"]';
const READ_ONLY_FIELD_SELECTOR = "input, textarea";
const NAVIGATION_KEYS = new Set([
  "Tab",
  "Shift",
  "Escape",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

/** Accordion triggers and marked view buttons stay usable; nothing else can change. */
const isAllowedControl = (element: Element | null) => {
  if (element instanceof HTMLAnchorElement)
    return element.hasAttribute(READ_ONLY_ALLOW_ATTRIBUTE) && element.hasAttribute("href");
  return (
    element instanceof HTMLButtonElement &&
    (element.hasAttribute(READ_ONLY_ALLOW_ATTRIBUTE) ||
      (element.hasAttribute("aria-expanded") &&
        element.hasAttribute("aria-controls") &&
        element.getAttribute("role") !== "combobox"))
  );
};

type Props = {
  children: ReactNode;
  className?: string;
  testId?: string;
};

export const ReadOnlyFrame = ({
  children,
  className,
  testId = "course-authoring-review-native-form",
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);

  /** React bubbles portal events through this tree; dialogs rendered elsewhere guard themselves. */
  const isOwnEvent = (event: SyntheticEvent) =>
    event.target instanceof Node && Boolean(ref.current?.contains(event.target));

  const blockEditing = (event: SyntheticEvent) => {
    if (!isOwnEvent(event)) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const blockInteractiveControl = (event: SyntheticEvent) => {
    if (!isOwnEvent(event)) return;
    const target = event.target instanceof Element ? event.target : null;
    const control = target?.closest(INTERACTIVE_SELECTOR) ?? null;
    if (!control || isAllowedControl(control)) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const blockClickUnlessAllowed = (event: SyntheticEvent) => {
    if (!isOwnEvent(event)) return;
    if (
      isAllowedControl(
        event.target instanceof Element ? event.target.closest("button, a[href]") : null,
      )
    )
      return;
    event.preventDefault();
    event.stopPropagation();
  };

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    const markReadOnly = () =>
      frame.querySelectorAll(READ_ONLY_FIELD_SELECTOR).forEach((field) => {
        field.setAttribute("readonly", "");
        field.setAttribute("aria-readonly", "true");
      });
    markReadOnly();
    const observer = new MutationObserver(markReadOnly);
    observer.observe(frame, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      aria-readonly="true"
      data-testid={testId}
      className={cn(
        "[&_[contenteditable]]:cursor-default [&_input]:cursor-default [&_textarea]:cursor-default",
        "[&_[data-testid$='-save-button']]:hidden [&_[data-testid$='-delete-button']]:hidden [&_[data-testid$='-cancel-button']]:hidden",
        "[&_[data-testid='curriculum-quiz-add-question-button']]:hidden",
        className,
      )}
      onClickCapture={blockClickUnlessAllowed}
      onPointerDownCapture={blockInteractiveControl}
      onKeyDownCapture={(event) => {
        if (!isOwnEvent(event) || NAVIGATION_KEYS.has(event.key)) return;
        if (
          (event.key === "Enter" || event.key === " ") &&
          isAllowedControl(event.target as Element)
        )
          return;
        blockEditing(event);
      }}
      onBeforeInputCapture={blockEditing}
      onPasteCapture={blockEditing}
      onDropCapture={blockEditing}
      onDragStartCapture={blockEditing}
      onSubmitCapture={blockEditing}
    >
      {children}
    </div>
  );
};
