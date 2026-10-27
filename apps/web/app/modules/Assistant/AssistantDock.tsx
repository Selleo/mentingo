import { useLocation, useNavigate } from "@remix-run/react";
import { isAxiosError } from "axios";
import { Maximize2, Minus, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { useAssistantThread } from "~/api/queries/assistant/useAssistantThread";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import { readAssistantSessionValue, writeAssistantSessionValue } from "./assistantSessionStorage";
import { AssistantConversation } from "./components/AssistantConversation";
import { BUBBLE_SIZE, useAssistantBubbleDrag } from "./useAssistantBubbleDrag";
import {
  ASSISTANT_SESSION_CHANGED,
  assistantSessionKey,
  readAssistantSelection,
  writeAssistantSelection,
} from "./useAssistantSession";

import type { CurrentUserResponse } from "~/api/generated-api";

export function AssistantDock({ actor }: { actor: CurrentUserResponse["data"] }) {
  const key = assistantSessionKey(
    actor,
    typeof window === "undefined" ? "" : window.location.origin,
  );
  return <ScopedAssistantDock key={key} sessionKey={key} />;
}

function ScopedAssistantDock({ sessionKey }: { sessionKey: string }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onAssistant = pathname === "/assistant" || pathname.startsWith("/assistant/");
  const [selection, setSelection] = useState<string | null>(null);
  const [validated, setValidated] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const openKey = `${sessionKey}:dock-open`;
  const updateOpen = (next: boolean | ((value: boolean) => boolean)) => {
    const value = typeof next === "function" ? next(open) : next;
    setOpen(value);
    writeAssistantSessionValue(openKey, String(value));
  };
  const [draft, setDraft] = useState("");
  const panel = useRef<HTMLElement>(null);
  const bubble = useRef<HTMLButtonElement>(null);
  const minimize = () => {
    updateOpen(false);
    requestAnimationFrame(() => bubble.current?.focus());
  };
  useEffect(() => {
    if (!open) return;
    const focus = requestAnimationFrame(() => panel.current?.focus());
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        setOpen(false);
        writeAssistantSessionValue(openKey, "false");
        bubble.current?.focus();
      }
    };
    window.addEventListener("keydown", escape);
    return () => {
      cancelAnimationFrame(focus);
      window.removeEventListener("keydown", escape);
    };
  }, [open, openKey]);
  const dismissalKey = `${sessionKey}:dock-dismissed`;
  const thread = useAssistantThread(onAssistant ? "" : (selection ?? ""));

  useEffect(() => {
    const sync = () => {
      setSelection(readAssistantSelection(sessionKey));
      setDismissed(readAssistantSessionValue(dismissalKey));
    };
    sync();
    window.addEventListener(ASSISTANT_SESSION_CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ASSISTANT_SESSION_CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, [dismissalKey, pathname, sessionKey]);

  useEffect(() => {
    const remembered = readAssistantSessionValue(openKey) === "true";
    setOpen(Boolean(selection) && !onAssistant && remembered);
    setDraft("");
  }, [onAssistant, openKey, selection]);

  useEffect(() => {
    if (!onAssistant) return;
    setOpen(false);
    setValidated(null);
    setDismissed(null);
    writeAssistantSessionValue(dismissalKey, null);
  }, [dismissalKey, onAssistant]);

  useEffect(() => {
    if (onAssistant || !selection || thread.isFetching) return;
    const denied =
      isAxiosError(thread.error) && [403, 404].includes(thread.error.response?.status ?? 0);
    if (denied || (thread.isSuccess && thread.data.archived)) {
      setValidated(null);
      writeAssistantSelection(sessionKey, null);
    } else if (thread.isSuccess && thread.data.id === selection) setValidated(selection);
  }, [
    onAssistant,
    selection,
    sessionKey,
    thread.data,
    thread.error,
    thread.isFetching,
    thread.isSuccess,
  ]);

  const dismiss = () => {
    updateOpen(false);
    setDismissed(selection);
    if (selection) writeAssistantSessionValue(dismissalKey, selection);
  };
  const drag = useAssistantBubbleDrag(
    dismiss,
    () => updateOpen(false),
    `${sessionKey}:dock-position:v2`,
  );
  const { viewport, position } = drag;
  if (onAssistant || !viewport || !selection || validated !== selection || dismissed === selection)
    return null;

  const width = Math.min(400, viewport.width - 24);
  const height = Math.min(560, viewport.height - 92);
  const left = Math.max(
    viewport.left + 12,
    Math.min(position.x + BUBBLE_SIZE - width, viewport.left + viewport.width - width - 12),
  );
  const preferredTop = position.y - height - 12;
  const top = Math.max(
    viewport.top + 12,
    Math.min(
      preferredTop >= viewport.top + 12 ? preferredTop : position.y + BUBBLE_SIZE + 12,
      viewport.top + viewport.height - height - 12,
    ),
  );

  return createPortal(
    <>
      {open && (
        <section
          ref={panel}
          role="dialog"
          tabIndex={-1}
          aria-label={t("assistant.floating.chat")}
          data-testid="assistant-floating-panel"
          style={{ left, top, width, height }}
          className="fixed z-[60] flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl"
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-950 dark:text-primary-300">
              <Icon name="AiMentor" className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">{t("navigationSideBar.aiAssistant")}</h2>
              <p className="truncate text-xs text-muted-foreground">{thread.data?.title}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg"
              aria-label={t("assistant.floating.fullScreen")}
              onClick={() =>
                navigate(`/assistant/${selection}`, { state: draft ? { draft } : null })
              }
            >
              <Maximize2 className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg"
              aria-label={t("assistant.floating.minimize")}
              onClick={minimize}
            >
              <Minus className="size-4" />
            </Button>
          </header>
          <AssistantConversation
            key={selection}
            threadId={selection}
            compact
            initialDraft={draft}
            onDraftChange={setDraft}
          />
        </section>
      )}
      <motion.button
        ref={bubble}
        type="button"
        data-testid="assistant-floating-bubble"
        aria-label={t(open ? "assistant.floating.minimize" : "assistant.floating.open")}
        aria-expanded={open}
        title={t("assistant.floating.dragHint")}
        style={{ x: drag.x, y: drag.y, touchAction: "none" }}
        className={cn(
          "fixed left-0 top-0 z-[65] flex size-14 select-none items-center justify-center rounded-full border border-primary-400 bg-primary-600 text-white shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300",
          { "cursor-grabbing scale-105": drag.dragging, "cursor-grab": !drag.dragging },
        )}
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        onPointerCancel={drag.onPointerCancel}
        onLostPointerCapture={drag.onPointerCancel}
        onKeyDown={drag.onKeyDown}
        onClick={(event) => {
          if (event.detail === 0 || !drag.shouldSuppressClick()) updateOpen((value) => !value);
        }}
      >
        <Icon name="AiMentor" className="size-8" />
      </motion.button>
      {drag.dragging && (
        <div
          style={{
            left: viewport.left,
            top: viewport.top + viewport.height - 144,
            width: viewport.width,
          }}
          className="pointer-events-none fixed z-[70] flex h-36 items-end justify-center pb-7"
          aria-hidden="true"
        >
          <div
            data-testid="assistant-floating-dismiss-target"
            className={cn(
              "flex size-16 items-center justify-center rounded-full border border-neutral-300 bg-neutral-100 text-neutral-700 shadow-md transition-transform motion-reduce:transition-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200",
              {
                "scale-125 border-error-300 bg-error-700 text-white dark:border-error-300 dark:bg-error-700 dark:text-white":
                  drag.overDismiss,
              },
            )}
          >
            <X className="size-6" strokeWidth={2} />
          </div>
          <span className="sr-only">{t("assistant.floating.dropToDismiss")}</span>
        </div>
      )}
    </>,
    document.body,
  );
}
