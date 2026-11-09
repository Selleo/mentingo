import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useCommitScormRuntime, useFinishScormRuntime } from "~/api/mutations";
import { courseLearningHeaders } from "~/api/utils/courseLearningHeaders";
import { toast } from "~/components/ui/use-toast";

import { attachScormBridge } from "../runtime/scormBridge";
import { SCORM_RUNTIME_EVENTS } from "../runtime/scormRuntime.constants";
import {
  createScorm12Api,
  filterWritableRuntimeValues,
  hasRuntimeValues,
  readRenderedRuntimeValues,
  asRuntimeValues,
} from "../runtime/scormRuntime.helpers";

import type { ScormLaunchData, ScormRuntimeValues } from "../ScormLesson.types";
import type { SupportedLanguages } from "@repo/shared";
import type { RefObject } from "react";
import type { Scorm12API } from "scorm-again";
import type { LaunchScormAttemptResponse } from "~/api/generated-api";

type UseScormRuntimeParams = {
  launch: ScormLaunchData;
  language: SupportedLanguages;
  onSavingChange?: (isSaving: boolean) => void;
  contentFrameRef: RefObject<HTMLIFrameElement>;
};

export function useScormRuntime({
  launch,
  language,
  onSavingChange,
  contentFrameRef,
}: UseScormRuntimeParams) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { mutateAsync: commitRuntime } = useCommitScormRuntime();
  const { mutateAsync: finishRuntime } = useFinishScormRuntime();
  const commitRuntimeRef = useRef(commitRuntime);
  const finishRuntimeRef = useRef(finishRuntime);
  const dirtyValuesRef = useRef<ScormRuntimeValues>({});
  const apiRef = useRef<Scorm12API | null>(null);
  const pendingSavesRef = useRef(0);
  const onSavingChangeRef = useRef(onSavingChange);
  const tRef = useRef(t);

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
    const api = createScorm12Api();
    const runtimeValues = asRuntimeValues(launchRuntimeRef.current.runtime);

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
        const result = await commitRuntimeRef.current({
          data: buildRuntimePayload(values),
          params: courseLearningHeaders(launch.learningStateId),
        });
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
      const renderedValues = readRenderedRuntimeValues(api);
      const values = filterWritableRuntimeValues({
        ...renderedValues,
        ...dirtyValuesRef.current,
      });

      if (!hasRuntimeValues(values)) {
        return;
      }

      dirtyValuesRef.current = {};

      beginRuntimeSave();
      try {
        const result = await finishRuntimeRef.current({
          data: buildRuntimePayload(values),
          params: courseLearningHeaders(launch.learningStateId),
        });
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

    api.loadFromFlattenedJSON(runtimeValues);
    api.on(SCORM_RUNTIME_EVENTS.SET_VALUE, (element: string, value: unknown) => {
      dirtyValuesRef.current[element] = String(value ?? "");
    });
    api.on(SCORM_RUNTIME_EVENTS.COMMIT, () => {
      void commitDirtyValues();
    });
    api.on(SCORM_RUNTIME_EVENTS.FINISH, () => {
      void finishRuntimeSession({ showToast: true });
    });

    apiRef.current = api;
    const detachBridge = attachScormBridge({
      api,
      launchUrl: launch.launchUrl,
      getFrame: () => contentFrameRef.current?.contentWindow,
    });

    return () => {
      if (api.isInitialized()) {
        void finishRuntimeSession({ showToast: false });
      }
      detachBridge();
      apiRef.current = null;
      dirtyValuesRef.current = {};
    };
  }, [
    language,
    launch.attemptId,
    launch.learningStateId,
    launch.courseId,
    launch.lessonId,
    launch.packageId,
    launch.scoId,
    launch.launchUrl,
    contentFrameRef,
    queryClient,
  ]);
}
