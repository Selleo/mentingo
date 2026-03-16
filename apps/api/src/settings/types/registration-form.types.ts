import type { LocalizedLabel } from "../schemas/registration-form.schema";
import type { RegistrationFormFieldType } from "@repo/shared";
import type { InferSelectModel } from "drizzle-orm";
import type { formFields } from "src/storage/schema";

type RegistrationFormFieldRow = InferSelectModel<typeof formFields>;

export type RegistrationFormFieldDbModel = Omit<
  RegistrationFormFieldRow,
  "formId" | "tenantId" | "type" | "label"
> & {
  type: RegistrationFormFieldType;
  label: LocalizedLabel;
};

export type LocalizedRegistrationFormFieldDbModel = Omit<RegistrationFormFieldDbModel, "label"> & {
  label: string;
};
