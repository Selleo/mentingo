import { z } from "zod";

import type i18next from "i18next";

export const magicLinkSchema = (t: typeof i18next.t) =>
  z.object({
    email: z.string().email({ message: t("magicLinkView.validation.email") }),
  });
