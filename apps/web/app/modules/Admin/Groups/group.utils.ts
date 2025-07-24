import * as z from "zod";

export const groupFormSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters.")
    .max(128, "Name cannot be longer than 128 characters."),
  characteristic: z.string().max(1024, "Name cannot be longer than 1024 characters."),
});

export type GroupFormValues = z.infer<typeof groupFormSchema>;
