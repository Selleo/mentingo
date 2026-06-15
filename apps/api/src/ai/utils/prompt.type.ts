import type { promptId } from "@repo/prompts";
import type { TSchema } from "@sinclair/typebox";
import type Handlebars from "handlebars";

export type CompiledTemplate = {
  id: promptId;
  template: Handlebars.TemplateDelegate;
  varsSchema?: TSchema;
};
