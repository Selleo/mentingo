import type { AiMentorType } from "@repo/shared";

export type AiMentorPromptContext = {
  title: string;
  instructions: string;
  type: AiMentorType;
  name: string;
  learnerFirstName: string;
};
