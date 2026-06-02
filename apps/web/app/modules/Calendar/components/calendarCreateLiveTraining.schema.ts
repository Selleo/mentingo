import { z } from "zod";

import type { TFunction } from "i18next";

export const getCalendarCreateLiveTrainingSchema = (t: TFunction) =>
  z
    .object({
      title: z.string().trim().min(1, t("calendarView.create.validation.titleRequired")),
      startsAt: z.date(),
      endsAt: z.date(),
    })
    .refine(({ startsAt, endsAt }) => endsAt > startsAt, {
      message: t("calendarView.create.validation.invalidDateRange"),
      path: ["endsAt"],
    });
