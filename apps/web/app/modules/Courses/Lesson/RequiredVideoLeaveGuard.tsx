import { useBlocker } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

import {
  getLessonVideoResumeTarget,
  hasStartedLessonVideo,
} from "./LessonVideoProgressStrip.utils";
import {
  getRequiredVideoLeavePreferenceKey,
  useRequiredVideoLeavePreferenceStore,
} from "./requiredVideoLeavePreferenceStore";

import type { LessonVideoProgressStore } from "./LessonVideoProgressStrip.types";

const BLOCKER_STATES = {
  BLOCKED: "blocked",
} as const;

type RequiredVideoLeaveGuardProps = {
  courseId: string;
  userId: string;
  lessonCompleted: boolean;
  enabled: boolean;
  store: LessonVideoProgressStore;
  onPause: () => void;
  onContinueWatching: (resourceEntityId: string | null) => void;
};

export const RequiredVideoLeaveGuard = ({
  courseId,
  userId,
  lessonCompleted,
  enabled,
  store,
  onPause,
  onContinueWatching,
}: RequiredVideoLeaveGuardProps) => {
  const { t } = useTranslation();

  const segments = useStore(store, (state) => state.segments);
  const lastActiveResourceEntityId = useStore(store, (state) => state.lastActiveResourceEntityId);
  const dismissed = useRequiredVideoLeavePreferenceStore(
    (state) => state.dismissed[getRequiredVideoLeavePreferenceKey(userId, courseId)] ?? false,
  );
  const dismissForCourse = useRequiredVideoLeavePreferenceStore((state) => state.dismissForCourse);

  const [rememberDecision, setRememberDecision] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const hasStartedVideo = segments.some(hasStartedLessonVideo);
  const shouldBlock = enabled && !lessonCompleted && hasStartedVideo && !dismissed;

  const blocker = useBlocker(shouldBlock);
  const previousBlockerStateRef = useRef(blocker.state);

  useEffect(() => {
    const becameBlocked =
      blocker.state === BLOCKER_STATES.BLOCKED &&
      previousBlockerStateRef.current !== BLOCKER_STATES.BLOCKED;
    previousBlockerStateRef.current = blocker.state;

    if (!becameBlocked) return;

    onPause();
    setRememberDecision(false);
    setIsDialogOpen(true);
  }, [blocker.state, onPause]);

  const remember = () => {
    if (!rememberDecision) return;
    dismissForCourse(getRequiredVideoLeavePreferenceKey(userId, courseId));
  };

  const exitAnyway = () => {
    remember();
    blocker.proceed?.();
    setIsDialogOpen(false);
  };

  const continueWatching = () => {
    remember();
    blocker.reset?.();
    onContinueWatching(getLessonVideoResumeTarget(segments, lastActiveResourceEntityId));
    setIsDialogOpen(false);
  };

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(open) => {
        if (!open && blocker.state === BLOCKER_STATES.BLOCKED) {
          exitAnyway();
          return;
        }
        setIsDialogOpen(open);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("studentLessonView.requiredVideoLeave.title")}</DialogTitle>
          <DialogDescription>
            {t(
              segments.length === 1
                ? "studentLessonView.requiredVideoLeave.descriptionSingle"
                : "studentLessonView.requiredVideoLeave.descriptionMultiple",
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 text-sm text-neutral-700">
          <Checkbox
            id="required-video-leave-dismiss"
            checked={rememberDecision}
            onCheckedChange={(checked) => setRememberDecision(checked === true)}
          />
          <label htmlFor="required-video-leave-dismiss">
            {t("studentLessonView.requiredVideoLeave.remember")}
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={exitAnyway}>
            {t("studentLessonView.requiredVideoLeave.exitAnyway")}
          </Button>
          <Button type="button" onClick={continueWatching}>
            {t("studentLessonView.requiredVideoLeave.continueWatching")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
