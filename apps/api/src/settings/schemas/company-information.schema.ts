import { companyInformationSchema } from "./settings.schema";

import type { Static } from "@sinclair/typebox";

export const companyInformationBodySchema = companyInformationSchema;

export type CompanyInformationBody = Static<typeof companyInformationBodySchema>;
