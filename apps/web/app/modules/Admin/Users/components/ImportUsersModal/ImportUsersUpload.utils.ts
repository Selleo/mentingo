import {
  USERS_IMPORT_SAMPLE_HEADERS,
  USERS_IMPORT_SAMPLE_ROLE,
} from "./ImportUsersUpload.constants";

import type { SupportedLanguages } from "@repo/shared";
import type { TFunction } from "i18next";

export const escapeCsvCell = (value: string) => {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
};

export const buildCsv = (rows: string[][]) =>
  rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");

export const buildUsersImportSampleCsv = (t: TFunction, language: SupportedLanguages) =>
  buildCsv([
    USERS_IMPORT_SAMPLE_HEADERS,
    [
      t("adminUsersView.modal.sampleFile.row.firstName"),
      t("adminUsersView.modal.sampleFile.row.lastName"),
      t("adminUsersView.modal.sampleFile.row.email"),
      USERS_IMPORT_SAMPLE_ROLE,
      [
        t("adminUsersView.modal.sampleFile.row.groupOne"),
        t("adminUsersView.modal.sampleFile.row.groupTwo"),
      ].join(","),
      language,
    ],
  ]);
