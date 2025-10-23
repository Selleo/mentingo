import { useTour } from "@reactour/tour";
import { useEffect, useMemo } from "react";

import { useMarkPageOnboardingAsCompleted } from "~/api/mutations/useMarkPageOnboardingAsCompleted";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import type { StepType } from "@reactour/tour";
import type { OnboardingPages } from "@repo/shared";

interface UseTourSetupProps {
  steps: StepType[];
  isLoading: boolean;
  hasCompletedTour: boolean | undefined;
  page: OnboardingPages;
}

export function useTourSetup({ steps, isLoading, hasCompletedTour, page }: UseTourSetupProps) {
  const { setSteps, setIsOpen, currentStep, isOpen, setCurrentStep } = useTour();
  const { mutate: markOnboardingPageAsCompleted } = useMarkPageOnboardingAsCompleted(page);

  const currentUser = useCurrentUserStore((state) => state.currentUser);

  const isLastStep = useMemo(() => currentStep === steps.length - 1, [currentStep, steps]);

  const shouldSkipTour = useMemo(
    () => hasCompletedTour || !currentUser,
    [hasCompletedTour, currentUser],
  );

  useEffect(() => {
    if (isLastStep && isOpen) {
      markOnboardingPageAsCompleted();
    }
  }, [markOnboardingPageAsCompleted, isOpen, isLastStep]);

  useEffect(() => {
    if (!shouldSkipTour && setSteps) {
      setSteps(steps);
      setCurrentStep(0);
    }
  }, [setSteps, steps, shouldSkipTour, setCurrentStep]);

  useEffect(() => {
    if (!isLoading && !shouldSkipTour) {
      setIsOpen(true);
    }
  }, [isLoading, setIsOpen, shouldSkipTour]);
}
