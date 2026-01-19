import { z } from "zod";

export const uploadFilesToLoginPageSchema = z.object({
  id: z.string().optional(),
  file: z.instanceof(File),
  name: z.string().min(1),
});

export const uploadedFilesToLoginPageSchema = z.object({
  files: z.array(
    z.object({
      id: z.string().optional(),
      file: z.instanceof(File),
      name: z.string().min(1),
    }),
  ),
});

export type UploadFilesToLoginPageValues = z.infer<typeof uploadFilesToLoginPageSchema>;
export type UploadedFilesToLoginPageValues = z.infer<typeof uploadedFilesToLoginPageSchema>;

export const uploadLoginPageFileDialogSchema = z.object({
  name: z.string().min(1),
});

export type UploadLoginPageFileDialogValues = z.infer<typeof uploadLoginPageFileDialogSchema>;
