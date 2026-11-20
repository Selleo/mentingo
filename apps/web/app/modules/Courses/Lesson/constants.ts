export const SELECT_OPTION_VARIANTS = {
  default:
    "border-primary-200 has-[input:checked]:bg-primary-50 has-[input:checked]:border-primary-500 has-[input:checked]:text-primary-500",
  checked: "bg-primary-50 border-primary-500 text-primary-500",
  correctAnswerSelected: "border-success-700 bg-success-50 text-success-700",
  correctAnswerUnselected: "border-warning-700 bg-warning-50 text-warning-700",
  incorrectAnswerSelected: "border-error-700 bg-error-50 text-error-700",
  redactedAnswerSelected: "border-neutral-400 bg-neutral-100 text-neutral-800",
};

// Input makes its focus outline transparent, so the answer card shows keyboard focus with a ring instead.
// Forced-colors mode removes box-shadow rings but paints that outline in a system colour, so focus stays visible there.
export const QUIZ_ANSWER_FOCUS_RING =
  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-700 has-[:focus-visible]:ring-offset-2";
