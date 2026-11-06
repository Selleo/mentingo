import { MAX_SCORM_PACKAGE_SIZE_BYTES, formatFileSize } from "@repo/shared";
import { z } from "zod";

export const courseFormSchema = z.object({
  scorm: z.object({
    file: z
      .custom<File>()
      .refine((file) => file instanceof File, "File is required")
      .refine(
        (file) => file instanceof File && file.size <= MAX_SCORM_PACKAGE_SIZE_BYTES,
        `File size must be less than ${formatFileSize(MAX_SCORM_PACKAGE_SIZE_BYTES)}`,
      )
      .refine(
        (file) => file instanceof File && file.name.endsWith(".zip"),
        "File must be a ZIP archive",
      ),
  }),
  details: z.object({
    title: z.string().min(1, "Title is required"),
    category: z.string().min(1, "Category is required"),
    description: z.string().max(180, "Description must be less than 180 characters"),
    thumbnail: z.custom<File>().optional(),
  }),
  pricing: z.object({
    type: z.enum(["free", "paid"]),
    price: z.number().optional(),
    currency: z.string().optional(),
  }),
  status: z.enum(["draft", "published"]),
});
