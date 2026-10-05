import { validateScormCall, SCORM_SESSION_PATTERN } from "@repo/shared";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useCommitScormRuntime, useFinishScormRuntime } from "~/api/mutations";
import { queryClient } from "~/api/queryClient";
import { toast } from "~/components/ui/use-toast";

import { parseScormLaunch } from "./scormBridge";
import {
  filterWritableRuntimeValues,
  hasRuntimeValues,
  asRuntimeValues,
} from "./scormRuntime.helpers";

import type { ScormLaunchData, ScormRuntimeValues } from "./ScormLesson.types";
import type { SupportedLanguages } from "@repo/shared";
import type { LaunchScormAttemptResponse } from "~/api/generated-api";

type UseScormRuntimeParams = {
  launch: ScormLaunchData;
  frame: React.RefObject<HTMLIFrameElement>;
  language: SupportedLanguages;
  onSavingChange?: (isSaving: boolean) => void;
};

export function useScormRuntime({
  launch,
  frame,
  language,
  onSavingChange,
}: UseScormRuntimeParams) {
  const { t } = useTranslation();

  const { mutateAsync: commitRuntime } = useCommitScormRuntime();
  const { mutateAsync: finishRuntime } = useFinishScormRuntime();
  const commitRuntimeRef = useRef(commitRuntime);
  const finishRuntimeRef = useRef(finishRuntime);
  const dirtyValuesRef = useRef<ScormRuntimeValues>({});

  const pendingSavesRef = useRef(0);
  const onSavingChangeRef = useRef(onSavingChange);
  const tRef = useRef(t);
  // Cache writes happen after every commit and finish. Keep the initial runtime
  // stable until the learner changes SCOs so saving cannot recreate the API.
  const launchRuntimeRef = useRef({
    key: `${launch.attemptId}:${launch.scoId}`,
    runtime: launch.runtime,
  });

  const launchKey = `${launch.attemptId}:${launch.scoId}`;
  if (launchRuntimeRef.current.key !== launchKey) {
    launchRuntimeRef.current = { key: launchKey, runtime: launch.runtime };
  }

  useEffect(() => {
    commitRuntimeRef.current = commitRuntime;
    finishRuntimeRef.current = finishRuntime;
    onSavingChangeRef.current = onSavingChange;
    tRef.current = t;
  }, [commitRuntime, finishRuntime, onSavingChange, t]);

  useEffect(() => {
    const bridge = parseScormLaunch(launch.launchUrl, window.location.origin);
    if (!bridge) return;
    const runtimeValues = asRuntimeValues(launchRuntimeRef.current.runtime);
    const state = { channel: bridge.channel, session: "", sequence: 0 };
    let initialized = false;
    let runtimeStarted = false;
    let finished = false;
    const currentValues = { ...runtimeValues };

    const buildRuntimePayload = (values: ScormRuntimeValues) => ({
      attemptId: launch.attemptId,
      packageId: launch.packageId,
      scoId: launch.scoId,
      lessonId: launch.lessonId,
      courseId: launch.courseId,
      values,
      language,
    });

    const beginRuntimeSave = () => {
      pendingSavesRef.current += 1;
      onSavingChangeRef.current?.(true);
    };

    const endRuntimeSave = () => {
      pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);

      if (pendingSavesRef.current === 0) {
        onSavingChangeRef.current?.(false);
      }
    };

    const invalidateRuntimeProgressQueries = async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["lesson"] }),
        queryClient.invalidateQueries({ queryKey: ["course"] }),
      ]);
    };

    const showRuntimeToast = (messageKey?: string | null) => {
      if (!messageKey) return;

      toast({ description: tRef.current(messageKey) });
    };

    const updateLaunchRuntimeCache = (values: ScormRuntimeValues) => {
      queryClient.setQueriesData<LaunchScormAttemptResponse>(
        { queryKey: ["scorm", "launch", launch.lessonId] },
        (cachedLaunch) => {
          if (!cachedLaunch || cachedLaunch.data.attemptId !== launch.attemptId) {
            return cachedLaunch;
          }

          return {
            ...cachedLaunch,
            data: {
              ...cachedLaunch.data,
              runtime: {
                ...asRuntimeValues(cachedLaunch.data.runtime),
                ...values,
              },
            },
          };
        },
      );
    };

    const commitDirtyValues = async () => {
      const values = filterWritableRuntimeValues(dirtyValuesRef.current);

      if (!hasRuntimeValues(values)) {
        dirtyValuesRef.current = {};
        return;
      }

      dirtyValuesRef.current = {};

      beginRuntimeSave();
      try {
        const result = await commitRuntimeRef.current({ data: buildRuntimePayload(values) });
        updateLaunchRuntimeCache(values);
        await invalidateRuntimeProgressQueries();
        showRuntimeToast(result.messageKey);
      } catch {
        dirtyValuesRef.current = { ...values, ...dirtyValuesRef.current };
      } finally {
        endRuntimeSave();
      }
    };

    const finishRuntimeSession = async ({ showToast }: { showToast: boolean }) => {
      const values = filterWritableRuntimeValues({
        ...currentValues,
        ...dirtyValuesRef.current,
      });

      if (!hasRuntimeValues(values)) {
        return;
      }

      dirtyValuesRef.current = {};

      beginRuntimeSave();
      try {
        const result = await finishRuntimeRef.current({ data: buildRuntimePayload(values) });
        updateLaunchRuntimeCache(values);
        await invalidateRuntimeProgressQueries();
        if (showToast) {
          showRuntimeToast(result.messageKey);
        }
      } catch {
        dirtyValuesRef.current = { ...values, ...dirtyValuesRef.current };
      } finally {
        endRuntimeSave();
      }
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== bridge.origin) return;
      const msg = event.data;
      if (!msg || typeof msg !== "object" || msg.channel !== bridge.channel) return;
      if (msg.type === "mentingo:scorm:ready") {
        if (typeof msg.session !== "string" || !SCORM_SESSION_PATTERN.test(msg.session)) return;
        if (!initialized) {
          state.session = msg.session;
          state.sequence = 0;
          initialized = true;
        }
        if (state.session === msg.session)
          frame.current?.contentWindow?.postMessage(
            {
              type: "mentingo:scorm:initialize",
              channel: bridge.channel,
              session: state.session,
              runtime: runtimeValues,
            },
            bridge.origin,
          );
        return;
      }
      if (!initialized || finished) return;
      const call = validateScormCall(msg, state);
      if (!call) return;
      switch (call.method) {
        case "LMSInitialize":
          runtimeStarted = true;
          break;
        case "LMSSetValue":
          currentValues[call.params[0]] = call.params[1];
          dirtyValuesRef.current[call.params[0]] = call.params[1];
          break;
        case "LMSCommit":
          void commitDirtyValues();
          break;
        case "LMSFinish":
          finished = true;
          void finishRuntimeSession({ showToast: true });
          break;
      }
    };
    window.addEventListener("message", onMessage);

    return () => {
      window.removeEventListener("message", onMessage);
      if (runtimeStarted && !finished) {
        void finishRuntimeSession({ showToast: false });
      }
      dirtyValuesRef.current = {};
    };
  }, [
    language,
    launch.attemptId,
    launch.courseId,
    launch.lessonId,
    launch.packageId,
    launch.scoId,
    launch.launchUrl,
    frame,
  ]);
}
