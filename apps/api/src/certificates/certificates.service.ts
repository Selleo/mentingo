import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";

import { getSortOptions } from "src/common/helpers/getSortOptions";
import { DEFAULT_PAGE_SIZE } from "src/common/pagination";

import { CertificateRepository } from "./certificate.repository";

import type { CertificatesQuery, AllCertificatesResponse } from "./certificates.types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { PaginatedResponse } from "src/common";
import type * as schema from "src/storage/schema";

@Injectable()
export class CertificatesService {
  constructor(private readonly certificateRepository: CertificateRepository) {}

  async getAllCertificates(
    query: CertificatesQuery,
  ): Promise<PaginatedResponse<AllCertificatesResponse>> {
    const { userId, page = 1, perPage = DEFAULT_PAGE_SIZE, sort = "createdAt" } = query;
    const { sortOrder } = getSortOptions(sort);

    try {
      return await this.certificateRepository.transaction(async (trx) => {
        const data = await this.certificateRepository.findCertificatesByUserId(
          userId,
          page,
          perPage,
          sortOrder,
          trx,
        );

        const totalItems = await this.certificateRepository.countByUserId(userId, trx);

        return { data, pagination: { totalItems, page, perPage } };
      });
    } catch (error) {
      console.error("Error fetching certificates:", error);
      throw new Error("Failed to fetch certificates");
    }
  }

  async createCertificate(
    userId: string,
    courseId: string,
    trx?: PostgresJsDatabase<typeof schema>,
  ) {
    try {
      const executeInTransaction = async (
        transactionInstance: PostgresJsDatabase<typeof schema>,
      ) => {
        const existingUser = await this.certificateRepository.findUserById(
          userId,
          transactionInstance,
        );
        const existingCourse = await this.certificateRepository.findCourseById(
          courseId,
          transactionInstance,
        );
        const courseCompletion = await this.certificateRepository.findCourseCompletion(
          userId,
          courseId,
          transactionInstance,
        );

        if (!existingUser) {
          throw new NotFoundException("User not found");
        }

        if (!existingCourse) {
          throw new NotFoundException("Course not found");
        }

        if (!existingCourse.certificateEnabled) {
          throw new BadRequestException("Certificates are disabled for this course");
        }

        if (!courseCompletion?.completedAt) {
          throw new BadRequestException("Course must be completed to generate certificate");
        }

        const existingCertificate = await this.certificateRepository.findExistingCertificate(
          userId,
          courseId,
          transactionInstance,
        );

        if (existingCertificate) {
          throw new ConflictException("Certificate already exists");
        }

        const createdCertificate = await this.certificateRepository.create(
          userId,
          courseId,
          transactionInstance,
        );

        if (!createdCertificate) {
          throw new ConflictException("Unable to create certificate");
        }

        return {
          ...createdCertificate,
          fullName: `${existingUser.firstName} ${existingUser.lastName}`,
          courseTitle: existingCourse.title,
          completionDate: new Date(courseCompletion.completedAt).toISOString(),
        };
      };

      if (trx) {
        return await executeInTransaction(trx);
      } else {
        return await this.certificateRepository.transaction(executeInTransaction);
      }
    } catch (error) {
      console.error("Error creating certificate:", error);
      throw error;
    }
  }

  async getCertificate(userId: string, courseId: string) {
    try {
      const certificate = await this.certificateRepository.findCertificateByUserAndCourse(
        userId,
        courseId,
      );

      if (!certificate) {
        throw new NotFoundException("Certificate not found");
      }

      return certificate;
    } catch (error) {
      console.error("Error fetching certificate:", error);
      throw error;
    }
  }
}
