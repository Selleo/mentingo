import { VariableExtension } from "@maily-to/core/extensions";
export const DisableMailyVariableExtension = VariableExtension.configure({
  variables: [],
  suggestion: {
    char: "\0",
    allow: () => false,
  },
});
