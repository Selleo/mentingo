import type { FixtureApiClient } from "../utils/api-client";
import type {
  GetAllCertificatesResponse,
  GetCertificateResetOptionsResponse,
  GetCertificateResetUsersResponse,
  GetCertificateResponse,
  GetCertificateValidityImpactBody,
  ResetCourseCertificatesBody,
} from "~/api/generated-api";

export type CertificateFactoryRecord = NonNullable<GetCertificateResponse>;
export type CertificateFactoryListRecord = GetAllCertificatesResponse["data"][number];

export class CertificateFactory {
  constructor(private readonly apiClient: FixtureApiClient) {}

  async getForCourse(input: {
    courseId: string;
    userId: string;
    language?: "en" | "pl" | "de" | "lt" | "cs" | "es";
  }): Promise<CertificateFactoryRecord | null> {
    const response = await this.apiClient.api.certificatesControllerGetCertificate({
      courseId: input.courseId,
      userId: input.userId,
      language: input.language ?? "en",
    });

    // The API can respond with an empty body (parsed by axios as "") instead of
    // a literal JSON `null` when no certificate exists, so treat any falsy value as "none".
    return response.data || null;
  }

  async getForLearningPath(input: {
    learningPathId: string;
    userId: string;
    language?: "en" | "pl" | "de" | "lt" | "cs" | "es";
  }): Promise<CertificateFactoryRecord | null> {
    const response = await this.apiClient.api.learningPathCertificateControllerGetCertificate({
      learningPathId: input.learningPathId,
      userId: input.userId,
      language: input.language ?? "en",
    });

    // The API can respond with an empty body (parsed by axios as "") instead of
    // a literal JSON `null` when no certificate exists, so treat any falsy value as "none".
    return response.data || null;
  }

  async createLearningPathShareLink(input: { certificateId: string; language?: string }) {
    const response =
      await this.apiClient.api.learningPathCertificateControllerCreateCertificateShareLink({
        certificateId: input.certificateId,
        language: input.language,
      });

    return response.data;
  }

  async getAll(query: {
    userId?: string;
    language?: "en" | "pl" | "de" | "lt" | "cs" | "es";
    page?: number;
    perPage?: number;
    sort?: string;
  }): Promise<CertificateFactoryListRecord[]> {
    const response = await this.apiClient.api.certificatesControllerGetAllCertificates(query);

    return response.data.data;
  }

  async createShareLink(input: { certificateId: string; language?: string }) {
    const response = await this.apiClient.api.certificatesControllerCreateCertificateShareLink({
      certificateId: input.certificateId,
      language: input.language,
    });

    return response.data;
  }

  async getValidityImpact(courseId: string, body: GetCertificateValidityImpactBody) {
    const response = await this.apiClient.api.certificatesControllerGetCertificateValidityImpact(
      courseId,
      body,
    );

    return response.data;
  }

  async getResetOptions(
    courseId: string,
    language: "en" | "pl" | "de" | "lt" | "cs" | "es" = "en",
  ): Promise<GetCertificateResetOptionsResponse> {
    const response = await this.apiClient.api.certificatesControllerGetCertificateResetOptions(
      courseId,
      { language },
    );

    return response.data;
  }

  async getResetUsers(
    courseId: string,
    query: {
      page?: number;
      perPage?: number;
      search?: string;
      language?: "en" | "pl" | "de" | "lt" | "cs" | "es";
    } = {},
  ): Promise<GetCertificateResetUsersResponse> {
    const response = await this.apiClient.api.certificatesControllerGetCertificateResetUsers(
      courseId,
      query,
    );

    return response.data;
  }

  async resetCourseCertificates(courseId: string, body: ResetCourseCertificatesBody) {
    const response = await this.apiClient.api.certificatesControllerResetCourseCertificates(
      courseId,
      body,
    );

    return response.data;
  }
}
