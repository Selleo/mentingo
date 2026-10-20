/** Numbered plan stepper shared by transcript plans and the live work rail. */
export const AuthoringPlanStepList = ({ steps }: { steps: string[] }) => (
  <ol className="py-1">
    {steps.map((step, index) => (
      <li key={`${index}-${step}`} className="relative flex gap-3 pb-3 last:pb-0">
        {index < steps.length - 1 && (
          <span
            aria-hidden="true"
            className="absolute bottom-0 left-[11px] top-6 w-px bg-neutral-200"
          />
        )}
        <span
          aria-hidden="true"
          className="relative flex size-6 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-[11px] font-semibold tabular-nums text-neutral-600"
        >
          {index + 1}
        </span>
        <span className="min-w-0 pt-0.5 text-sm leading-5 text-neutral-800">{step}</span>
      </li>
    ))}
  </ol>
);
