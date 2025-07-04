import { Icon } from "~/components/Icon";
import { cn } from "~/lib/utils";

import type { SCORM_CONFIG } from "../scorm.config";

interface ProgressProps {
  currentStep: number;
  steps: typeof SCORM_CONFIG;
}

export const Progress = ({ currentStep, steps }: ProgressProps) => {
  return (
    <div className="mb-8 flex w-full items-center justify-between">
      {steps.map((step, index) => {
        const state = (() => {
          if (currentStep === index) return "current";
          if (currentStep > index) return "previous";
          return "upcoming";
        })();

        const isLastStep = index === steps.length - 1;

        return (
          <div key={step.id} className={cn("flex items-center", { "flex-1": !isLastStep })}>
            <div
              className={cn(
                "relative flex size-10 items-center justify-center rounded-full bg-primary-50 transition-all duration-300 ease-in-out",
                {
                  "bg-secondary-50": state === "current",
                  "bg-success-50": state === "previous",
                },
              )}
            >
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300",
                  {
                    "opacity-100": state === "current",
                  },
                )}
              >
                <Icon name="InProgress" className="size-6" />
              </div>

              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300",
                  {
                    "opacity-100": state === "previous",
                  },
                )}
              >
                <div className="size-6 rounded-full border-2 border-success-600 p-px text-success-600">
                  <Icon name="Checkmark" />
                </div>
              </div>

              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300",
                  {
                    "opacity-100": state === "upcoming",
                  },
                )}
              >
                <span className="text-sm font-medium text-primary-700">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
            </div>

            {!isLastStep && (
              <div className="mx-4 flex-1">
                <div className="h-1 rounded-full bg-primary-100">
                  <div
                    className={cn(
                      "h-full rounded-full bg-success-200 transition-all duration-500 ease-in-out",
                      {
                        "w-full": currentStep > index,
                        "w-0": currentStep <= index,
                      },
                    )}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
