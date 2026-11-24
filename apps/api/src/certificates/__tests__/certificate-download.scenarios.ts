import { SUPPORTED_LANGUAGES } from "@repo/shared";

export const PDF_LANGUAGE_CASES = [
  {
    language: SUPPORTED_LANGUAGES.EN,
    learnerName: { firstName: "Jan", lastName: "Kowalski" },
    expectedContentDisposition:
      "attachment; filename=\"Certificate - Python Basics - Jan Kowalski.pdf\"; filename*=UTF-8''Certificate%20-%20Python%20Basics%20-%20Jan%20Kowalski.pdf",
    expectedTitle: "Certificate of completion – Python Basics",
  },
  {
    language: SUPPORTED_LANGUAGES.PL,
    learnerName: { firstName: "Łukasz", lastName: "Żółkiewski" },
    expectedContentDisposition:
      "attachment; filename=\"Certyfikat - Python Basics - Lukasz Zolkiewski.pdf\"; filename*=UTF-8''Certyfikat%20-%20Python%20Basics%20-%20%C5%81ukasz%20%C5%BB%C3%B3%C5%82kiewski.pdf",
    expectedTitle: "Certyfikat ukończenia – Python Basics",
  },
];

export const DOWNLOAD_REQUESTERS = {
  COURSE_AUTHOR: "the course author",
  ADMIN: "an admin of another author's course",
  ADMIN_ALSO_GROUP_MANAGER: "an admin who also manages groups",
  GROUP_MANAGER_OWN_CERTIFICATE: "a group manager downloading their own certificate",
  GROUP_MANAGER_MANAGED_LEARNER: "a group manager of the learner's group",
  UNRELATED_AUTHOR: "an author of other courses",
  ANOTHER_LEARNER: "another learner",
  ADMIN_ARCHIVED_CERTIFICATE: "an admin requesting an archived certificate",
  ADMIN_DELETED_LEARNER: "an admin requesting a deleted learner's certificate",
  ADMIN_OTHER_TENANT: "an admin requesting another tenant's certificate",
  GROUP_MANAGER_UNMANAGED_LEARNER: "a group manager of other groups",
} as const;

export type DownloadRequester = (typeof DOWNLOAD_REQUESTERS)[keyof typeof DOWNLOAD_REQUESTERS];

export const DOWNLOAD_ACCESS_OUTCOMES = {
  RENDERED: "renders the PDF",
  NOT_FOUND: "answers not found",
} as const;

export const DOWNLOAD_ACCESS_CASES = [
  { requester: DOWNLOAD_REQUESTERS.COURSE_AUTHOR, outcome: DOWNLOAD_ACCESS_OUTCOMES.RENDERED },
  { requester: DOWNLOAD_REQUESTERS.ADMIN, outcome: DOWNLOAD_ACCESS_OUTCOMES.RENDERED },
  {
    requester: DOWNLOAD_REQUESTERS.ADMIN_ALSO_GROUP_MANAGER,
    outcome: DOWNLOAD_ACCESS_OUTCOMES.RENDERED,
  },
  {
    requester: DOWNLOAD_REQUESTERS.GROUP_MANAGER_OWN_CERTIFICATE,
    outcome: DOWNLOAD_ACCESS_OUTCOMES.RENDERED,
  },
  {
    requester: DOWNLOAD_REQUESTERS.GROUP_MANAGER_MANAGED_LEARNER,
    outcome: DOWNLOAD_ACCESS_OUTCOMES.RENDERED,
  },
  { requester: DOWNLOAD_REQUESTERS.UNRELATED_AUTHOR, outcome: DOWNLOAD_ACCESS_OUTCOMES.NOT_FOUND },
  { requester: DOWNLOAD_REQUESTERS.ANOTHER_LEARNER, outcome: DOWNLOAD_ACCESS_OUTCOMES.NOT_FOUND },
  {
    requester: DOWNLOAD_REQUESTERS.ADMIN_ARCHIVED_CERTIFICATE,
    outcome: DOWNLOAD_ACCESS_OUTCOMES.NOT_FOUND,
  },
  {
    requester: DOWNLOAD_REQUESTERS.ADMIN_DELETED_LEARNER,
    outcome: DOWNLOAD_ACCESS_OUTCOMES.NOT_FOUND,
  },
  {
    requester: DOWNLOAD_REQUESTERS.ADMIN_OTHER_TENANT,
    outcome: DOWNLOAD_ACCESS_OUTCOMES.NOT_FOUND,
  },
  {
    requester: DOWNLOAD_REQUESTERS.GROUP_MANAGER_UNMANAGED_LEARNER,
    outcome: DOWNLOAD_ACCESS_OUTCOMES.NOT_FOUND,
  },
];
