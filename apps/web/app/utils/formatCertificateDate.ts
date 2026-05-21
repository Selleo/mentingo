import { format } from "date-fns";

const FORMATTED_CERTIFICATE_DATE_PATTERN = /^\d{2}\.\d{2}\.\d{4}$/;

export const formatCertificateDate = (completionDate?: string | null) => {
  if (!completionDate) return "";

  if (FORMATTED_CERTIFICATE_DATE_PATTERN.test(completionDate)) {
    return completionDate;
  }

  const parsedDate = new Date(completionDate);

  if (Number.isNaN(parsedDate.getTime())) return "";

  return format(parsedDate, "dd.MM.yyyy");
};
