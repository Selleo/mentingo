export interface CertificateType {
  id: string;
  userId: string;
  courseId: string;
  courseTitle?: string | null;
  completionDate?: string | null;
  fullName?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface CertificatesResponse {
  data: CertificateType[];
  pagination: {
    totalItems: number;
    page: number;
    perPage: number;
  };
  appliedFilters?: object;
}
export interface UpdateHasCertificateBody {
  hasCertificate: boolean;
}
