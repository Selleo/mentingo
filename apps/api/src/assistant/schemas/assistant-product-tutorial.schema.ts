import { Type } from "@sinclair/typebox";

import { helpdeskSearchRequestSchema } from "src/self-onboarding/schemas/self-onboarding.schema";

/** Native chat has no verified page/domain context. Do not let the model invent
 * catalog filters; the UI and external MCP retain their contextual search inputs. */
export const assistantProductTutorialSearchSchema = Type.Pick(
  helpdeskSearchRequestSchema,
  ["query", "language", "mode", "limit"],
  { additionalProperties: false },
);
