import { AsyncLocalStorage } from "node:async_hooks";

export const courseLearningContext = new AsyncLocalStorage<{
  learningStateId: string | null;
  readOnly?: boolean;
}>();
