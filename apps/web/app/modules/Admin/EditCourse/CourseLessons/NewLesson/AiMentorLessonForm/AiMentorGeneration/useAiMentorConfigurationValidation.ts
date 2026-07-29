import { useCallback, useEffect, useRef, useState } from "react";

import type { AiMentorValidationResult } from "./aiMentorGeneration.types";
import type { AiMentorConfigurationDraft } from "../AiMentorConfiguration/aiMentorConfiguration.types";

type ValidateAiMentorConfiguration = (
  configuration: AiMentorConfigurationDraft,
  signal: AbortSignal,
) => Promise<AiMentorValidationResult>;

export const useAiMentorConfigurationValidation = (validate: ValidateAiMentorConfiguration) => {
  const [result, setResult] = useState<AiMentorValidationResult>();
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
    async (configuration: AiMentorConfigurationDraft) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setIsChecking(true);
      clearResult();

      try {
        const validation = await validate(configuration, controller.signal);
        if (controller.signal.aborted) return;
        setResult(validation);
        return validation;
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
      controllerRef.current = undefined;
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
