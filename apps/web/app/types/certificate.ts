export type Certificate = {
  id: string;
  userId: string;
  courseId: string;
  courseTitle?: string | null;
  completionDate?: string | null;
  fullName?: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

export type CertificatesResponse = {
  data: Certificate[];
  pagination: {
    totalItems: number;
    page: number;
    perPage: number;
  };
  appliedFilters?: object;
};
