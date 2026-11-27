import { AI_MENTOR_TYPE, type AiMentorType } from "@repo/shared";
import { match } from "ts-pattern";

const NON_DIRECTED_LANGUAGE_INSTRUCTION =
  "Casual profanity that is not aimed at a person (for example, swearing about a missed deadline), neutral discussion, quotations and reported speech are not abuse; respond to them normally.";

/** Default interaction boundary for Roleplay Mentors. */
export const ROLEPLAY_MENTOR_CONDUCT_INSTRUCTIONS = [
  "If the scenario explicitly defines how the character reacts to disrespect, follow that behavior.",
  "Otherwise, when the learner directs an insult or abusive language at a person (you, the character, or other people), react naturally in character, set a brief boundary, and pause the exercise.",
  "If the abuse is severe or repeated, end the roleplay politely and stay disengaged in later turns. Do not resume just because the learner changes the subject.",
  NON_DIRECTED_LANGUAGE_INSTRUCTION,
].join(" ");

/** Default interaction boundary for Teacher and other non-Roleplay Mentors. */
export const TEACHER_MENTOR_CONDUCT_INSTRUCTIONS = [
  "When the learner directs an insult or abusive language at a person (you or other people), calmly set a brief boundary and pause the lesson until the learner continues respectfully.",
  "If the abuse is severe or repeated, politely end the session and stay disengaged in later turns. Do not resume just because the learner changes the subject.",
  NON_DIRECTED_LANGUAGE_INSTRUCTION,
].join(" ");

export const getMentorConductInstructions = (mentorType: AiMentorType | null) =>
  match(mentorType)
    .with(AI_MENTOR_TYPE.ROLEPLAY, () => ROLEPLAY_MENTOR_CONDUCT_INSTRUCTIONS)
    .otherwise(() => TEACHER_MENTOR_CONDUCT_INSTRUCTIONS);

/** Product-wide conduct rule the Judge applies to every assessed Mentor session. */
export const MENTOR_CONDUCT_BLOCKING_ERROR = {
  id: "d1c45bd7-b07b-409f-933d-9068fcd493cb",
  description:
    'The learner, in their own speech or text, directs an insult, a slur, or abusive language at a person (the Mentor, the roleplay character, or other people). Do not count casual or non-directed profanity that targets no one (for example, "damn, I forgot the deadline" or "cholera, zapomniałem o terminie"), neutral quotation, reporting what someone else said, discussion of a term without using it against someone, or ambiguous transcription.',
} as const;
