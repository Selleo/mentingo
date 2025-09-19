import { z } from "zod";

import type i18next from "i18next";

export const createAnnouncementSchema = (t: typeof i18next.t) =>
  z.object({
    title: z
      .string()
      .min(1, t("announcements.createPage.validation.title.required"))
      .max(120, t("announcements.createPage.validation.title.maxLength")),
    content: z.string().min(1, t("announcements.createPage.validation.content.required")),
    groupId: z.string().uuid().nullable(),
  });
