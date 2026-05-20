import { LIVE_TRAINING_DESCRIPTION_MAX_LENGTH, LIVE_TRAINING_TITLE_MAX_LENGTH } from "@repo/shared";

export const buildLiveTrainingStageDateTime = (date: string, time: string) =>
  new Date(`${date}T${time}:00`).toISOString();

export const trimLiveTrainingDescriptionForPreview = (description: string) =>
  description.length > LIVE_TRAINING_DESCRIPTION_MAX_LENGTH
    ? `${description.slice(0, LIVE_TRAINING_DESCRIPTION_MAX_LENGTH).trimEnd()}...`
    : description;

export const limitLiveTrainingDescription = (description: string) =>
  description.slice(0, LIVE_TRAINING_DESCRIPTION_MAX_LENGTH);

export const limitLiveTrainingTitle = (title: string) =>
  title.slice(0, LIVE_TRAINING_TITLE_MAX_LENGTH);

export const resizeLiveTrainingTextArea = (
  textAreaElement: HTMLTextAreaElement,
  maxHeight: number,
) => {
  textAreaElement.style.height = "auto";
  textAreaElement.style.height = `${Math.min(textAreaElement.scrollHeight, maxHeight)}px`;
  textAreaElement.style.overflowY = textAreaElement.scrollHeight > maxHeight ? "auto" : "hidden";
};
