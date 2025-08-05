import { companyInformationJSONSchema } from "./settings.schema";

import type { Static } from "@sinclair/typebox";

export const companyInformatioJSONSchema = companyInformationJSONSchema;

export type CompanyInformaitonJSONSchema = Static<typeof companyInformatioJSONSchema>;
