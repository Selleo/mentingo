import type { GetLessonByIdResponse } from "~/api/generated-api";

export type LiveTrainingDetails = NonNullable<GetLessonByIdResponse["data"]["liveTraining"]>;
export type LiveTrainingMaterial = LiveTrainingDetails["materials"]["before"][number];
