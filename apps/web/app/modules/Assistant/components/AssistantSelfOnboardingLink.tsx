import { useEffect, useRef, useState } from "react";

import { cn } from "~/lib/utils";
import {
  helpdeskTutorialPath,
  readHelpdeskTutorialReference,
} from "~/modules/SelfOnboarding/self-onboarding.helpers";
import HelpdeskTutorialDialog from "~/modules/SelfOnboarding/SelfOnboardingTutorialDialog";

import type { AssistantSource } from "../assistant.types";
import type { ReactNode } from "react";

type Props = {
  source: AssistantSource;
  children: ReactNode;
  className?: string;
  testId?: string;
};

/** Verified help citations open compatible metadata in place; the conversation never navigates. */
export function AssistantHelpdeskLink({ source, children, className, testId }: Props) {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<string>();
  const trigger = useRef<HTMLAnchorElement>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const reference = readHelpdeskTutorialReference(
    source.url,
    origin ?? "https://assistant.invalid",
  );
  if (!reference) return <span>{children}</span>;

  return (
    <>
      <a
        ref={trigger}
        href={helpdeskTutorialPath(reference.key, reference.chapterId)}
        data-testid={testId}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "rounded-sm text-primary-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-300",
          className,
        )}
        onClick={(event) => {
          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </a>
      {open && (
        <HelpdeskTutorialDialog
          tutorialKey={reference.key}
          chapterId={reference.chapterId}
          onClose={() => setOpen(false)}
          onRestoreFocus={() => trigger.current?.focus()}
        />
      )}
    </>
  );
}
