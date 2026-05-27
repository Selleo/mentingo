import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useCommitScormRuntime, useFinishScormRuntime } from "~/api/mutations";
import { toast } from "~/components/ui/use-toast";

import {
  createScorm12Api,
  exposeScormApi,
  filterWritableRuntimeValues,
  hasRuntimeValues,
  readRenderedRuntimeValues,
  removeScormApi,
  SCORM_COMMIT_EVENT,
  SCORM_FINISH_EVENT,
  SCORM_SET_VALUE_EVENT,
  asRuntimeValues,
} from "./scormRuntime.helpers";

import type { ScormLaunchData, ScormRuntimeValues } from "./ScormLesson.types";
import type { SupportedLanguages } from "@repo/shared";
import type { Scorm12API } from "scorm-again";
import type { LaunchScormAttemptResponse } from "~/api/generated-api";

type UseScormRuntimeParams = {
  launch: ScormLaunchData;
  language: SupportedLanguages;
  onSavingChange?: (isSaving: boolean) => void;
};

export function useScormRuntime({ launch, language, onSavingChange }: UseScormRuntimeParams) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { mutateAsync: commitRuntime } = useCommitScormRuntime();
  const { mutateAsync: finishRuntime } = useFinishScormRuntime();
  const commitRuntimeRef = useRef(commitRuntime);
  const finishRuntimeRef = useRef(finishRuntime);
  const dirtyValuesRef = useRef<ScormRuntimeValues>({});
  const apiRef = useRef<Scorm12API | null>(null);
  const pendingSavesRef = useRef(0);

  useEffect(() => {
    commitRuntimeRef.current = commitRuntime;
    finishRuntimeRef.current = finishRuntime;
  }, [commitRuntime, finishRuntime]);

  useEffect(() => {
    const api = createScorm12Api();
    const runtimeValues = asRuntimeValues(launch.runtime);

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
      onSavingChange?.(true);
    };

    const endRuntimeSave = () => {
      pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);

      if (pendingSavesRef.current === 0) {
        onSavingChange?.(false);
      }
    };

    const handleProgressUpdate = async (lessonCompleted: boolean) => {
      if (!lessonCompleted) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["lesson"] }),
        queryClient.invalidateQueries({ queryKey: ["course"] }),
      ]);
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
        await handleProgressUpdate(result.lessonCompleted);
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
        const result = await finishRuntimeRef.current({ data: buildRuntimePayload(values) });
        updateLaunchRuntimeCache(values);
        await handleProgressUpdate(result.lessonCompleted);
        if (showToast) {
          toast({ description: t("studentLessonView.scorm.lessonFinished") });
        }
      } catch {
        dirtyValuesRef.current = { ...values, ...dirtyValuesRef.current };
      } finally {
        endRuntimeSave();
      }
    };

    api.loadFromFlattenedJSON(runtimeValues);
    api.on(SCORM_SET_VALUE_EVENT, (element: string, value: unknown) => {
      dirtyValuesRef.current[element] = String(value ?? "");
    });
    api.on(SCORM_COMMIT_EVENT, () => {
      void commitDirtyValues();
    });
    api.on(SCORM_FINISH_EVENT, () => {
      void finishRuntimeSession({ showToast: true });
    });

    apiRef.current = api;
    exposeScormApi(api);

    return () => {
      void finishRuntimeSession({ showToast: false });
      removeScormApi(api);
      apiRef.current = null;
      dirtyValuesRef.current = {};
    };
  }, [
    language,
    launch.attemptId,
    launch.courseId,
    launch.lessonId,
    launch.packageId,
    launch.runtime,
    launch.scoId,
    onSavingChange,
    queryClient,
    t,
  ]);
}
