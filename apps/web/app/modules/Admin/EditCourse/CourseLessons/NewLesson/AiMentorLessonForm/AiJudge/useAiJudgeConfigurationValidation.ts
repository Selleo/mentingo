import { useCallback, useEffect, useRef, useState } from "react";

import type {
  AiJudgeConfigurationDraft,
  AiJudgeValidationResult,
} from "./aiJudgeConfiguration.types";

type ValidateAiJudgeConfiguration = (
  configuration: AiJudgeConfigurationDraft,
  signal?: AbortSignal,
) => Promise<AiJudgeValidationResult>;

export const useAiJudgeConfigurationValidation = (validate?: ValidateAiJudgeConfiguration) => {
  const [result, setResult] = useState<AiJudgeValidationResult>();
  const [isChecking, setIsChecking] = useState(false);
  const controllerRef = useRef<AbortController>();

  const clearResult = useCallback(() => setResult(undefined), []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = undefined;
    setIsChecking(false);
    clearResult();
  }, [clearResult]);

  const validateConfiguration = useCallback(
    async (configuration: AiJudgeConfigurationDraft) => {
      if (!validate) return;

      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setIsChecking(true);

      try {
        const validationResult = await validate(configuration, controller.signal);
        if (!controller.signal.aborted) setResult(validationResult);
      } catch {
        if (!controller.signal.aborted) clearResult();
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = undefined;
          setIsChecking(false);
        }
      }
    },
    [clearResult, validate],
  );

  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  return {
    result,
    isChecking,
    validateConfiguration,
    cancel,
    clearResult,
  };
};
