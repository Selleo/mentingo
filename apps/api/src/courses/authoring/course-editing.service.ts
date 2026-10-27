import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import {
  COURSE_FEATURE,
  COURSE_STATUSES,
  COURSE_TYPE,
  DEFAULT_CERTIFICATE_FONT_COLOR,
  ENTITY_TYPES,
  type SupportedLanguages,
} from "@repo/shared";
import { pickBy } from "lodash";

import { CertificatesService } from "src/certificates/certificates.service";
import { buildJsonbField, buildJsonbStringArrayField } from "src/common/helpers/sqlHelpers";
import { canUpdateCourseByAuthor } from "src/common/permissions/course-permission.utils";
import { UpdateHasCertificateEvent } from "src/courses/events/updateHasCertificate.event";
import { EnvService } from "src/env/services/env.service";
import { CreateCourseEvent, UpdateCourseEvent } from "src/events";
import { FileService } from "src/file/file.service";
import { IMAGE_QUALITY } from "src/file/image-variants/image-variant.constants";
import { SearchIndexService } from "src/global-search/search-index.service";
import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { SettingsService } from "src/settings/settings.service";
import { courses } from "src/storage/schema";
import { StripeService } from "src/stripe/stripe.service";
import { hasLocalizableUpdates } from "src/utils/getLocalizableKeys";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import {
  LESSON_SEQUENCE_ENABLED,
  QUIZ_FEEDBACK_ENABLED,
  VIDEO_COMPLETION_TRACKING_ENABLED,
} from "../constants";
import { MasterCourseService } from "../master-course/master-course.service";
import { CourseAuthorService } from "../ownership/course-author.service";

import { CourseActivitySnapshotService } from "./course-activity-snapshot.service";
import { CourseEditingRepository } from "./course-editing.repository";
import { CourseFeaturePolicyService } from "./course-feature-policy.service";
import { CourseSlugService } from "./course-slug.service";

import type { LessonSequenceEnabledResponse } from "../schemas/course.schema";
import type { CreateCourseBody } from "../schemas/createCourse.schema";
import type { UpdateCourseBody } from "../schemas/updateCourse.schema";
import type { UpdateCourseMediaBody } from "../schemas/updateCourseMedia.schema";
import type { UpdateCourseSettings } from "../schemas/updateCourseSettings.schema";
import type { CoursesSettings } from "../types/settings";
import type { CourseActivityLogSnapshot } from "src/activity-logs/types";
import type { DatabasePg, UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type Stripe from "stripe";

type EditedCourse = NonNullable<Awaited<ReturnType<CourseEditingRepository["findCourseById"]>>>;

const CERTIFICATE_SETTING_KEYS = [
  "certificateValidity",
  "applyValidityToExistingCertificates",
  "certificateFontColor",
  "removeCertificateSignature",
  "certificateSignature",
];

const NON_STORED_SETTING_KEYS = [
  "removeCertificateSignature",
  "applyValidityToExistingCertificates",
  "certificateSignature",
];

@Injectable()
export class CourseEditingService {
  constructor(
    private readonly courseEditingRepository: CourseEditingRepository,
    private readonly courseActivitySnapshotService: CourseActivitySnapshotService,
    private readonly courseAuthorService: CourseAuthorService,
    private readonly courseFeaturePolicyService: CourseFeaturePolicyService,
    private readonly courseSlugService: CourseSlugService,
    private readonly masterCourseService: MasterCourseService,
    private readonly certificatesService: CertificatesService,
    private readonly fileService: FileService,
    private readonly envService: EnvService,
    private readonly settingsService: SettingsService,
    private readonly stripeService: StripeService,
    private readonly searchIndexService: SearchIndexService,
    private readonly localizationService: LocalizationService,
    private readonly outboxPublisher: OutboxPublisher,
  ) {}

  async createCourse(
    createCourseBody: CreateCourseBody,
    currentUser: CurrentUserType,
    isPlaywrightTest: boolean,
  ) {
    const newCourse = await this.courseEditingRepository.runInTransaction((trx) =>
      this.createCourseInTransaction(createCourseBody, currentUser, isPlaywrightTest, trx),
    );

    await this.publishCreateCourseEvent(newCourse.id, createCourseBody.language, currentUser);

    return newCourse;
  }

  /** Creates the course, its Stripe product (when configured) and its statistics row. */
  async createCourseInTransaction(
    createCourseBody: CreateCourseBody,
    currentUser: CurrentUserType,
    isPlaywrightTest: boolean,
    trx: DatabasePg,
  ) {
    const categoryExists = await this.courseEditingRepository.categoryExists(
      createCourseBody.categoryId,
      trx,
    );

    const { enabled: isStripeConfigured } = await this.envService.getStripeConfigured();

    if (!categoryExists) {
      throw new NotFoundException("adminCourseView.errors.notFound.category");
    }

    const globalSettings = await this.settingsService.getGlobalSettings();
    const finalCurrency = globalSettings.defaultCourseCurrency || "usd";

    const { productId, priceId } =
      !isPlaywrightTest && isStripeConfigured
        ? await this.createStripeProductForNewCourse(createCourseBody, finalCurrency)
        : { productId: null, priceId: null };

    const isScormCourse = createCourseBody.isScorm === true;
    const settings = this.courseEditingRepository.buildNewCourseSettings({
      lessonSequenceEnabled: isScormCourse ? false : LESSON_SEQUENCE_ENABLED,
      quizFeedbackEnabled: isScormCourse ? false : QUIZ_FEEDBACK_ENABLED,
      videoCompletionTrackingEnabled: isScormCourse ? false : VIDEO_COMPLETION_TRACKING_ENABLED,
      certificateFontColor: DEFAULT_CERTIFICATE_FONT_COLOR,
    });

    const newCourse = await this.courseEditingRepository.insertCourse(
      {
        title: buildJsonbField(createCourseBody.language, createCourseBody.title),
        description: buildJsonbField(createCourseBody.language, createCourseBody.description),
        baseLanguage: createCourseBody.language,
        availableLocales: [createCourseBody.language],
        learningOutcomes: buildJsonbStringArrayField(
          createCourseBody.language,
          createCourseBody.learningOutcomes ?? [],
        ),
        thumbnailS3Key: createCourseBody.thumbnailS3Key,
        status: createCourseBody.status,
        priceInCents: createCourseBody.priceInCents,
        currency: finalCurrency,
        courseType: isScormCourse ? COURSE_TYPE.SCORM : COURSE_TYPE.DEFAULT,
        authorId: currentUser.userId,
        authorMetadata: await this.courseAuthorService.getAuthorMetadata(currentUser.userId, trx),
        categoryId: createCourseBody.categoryId,
        stripeProductId: productId,
        stripePriceId: priceId,
        settings: settingsToJSONBuildObject(settings),
      },
      trx,
    );

    if (!newCourse) {
      throw new ConflictException("adminCourseView.errors.create.courseFailed");
    }

    await this.courseEditingRepository.insertCourseSummaryStats(
      newCourse.id,
      currentUser.userId,
      trx,
    );

    await this.searchIndexService.refreshCourse(newCourse.id, trx);

    return newCourse;
  }

  async publishCreateCourseEvent(
    courseId: UUIDType,
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ) {
    const createdCourseSnapshot =
      await this.courseActivitySnapshotService.buildCourseActivitySnapshot(courseId, language);

    await this.outboxPublisher.publish(
      new CreateCourseEvent({
        courseId,
        actor: currentUser,
        createdCourse: createdCourseSnapshot,
      }),
    );
  }

  /**
   * Updates course details in the requested language and keeps the Stripe product and price in
   * sync when Stripe is configured.
   */
  async updateCourse(
    id: UUIDType,
    updateCourseBody: UpdateCourseBody,
    currentUser: CurrentUserType,
    isPlaywrightTest: boolean,
  ) {
    const attemptedFieldKeys = Object.entries(updateCourseBody)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);

    await this.masterCourseService.assertCourseContentEditable(
      id,
      ["status", "priceInCents", "currency", "language"],
      attemptedFieldKeys,
    );

    const { updatedCourse, previousCourseSnapshot, updatedCourseSnapshot } =
      await this.courseEditingRepository.runInTransaction(async (trx) => {
        const existingCourse = await this.courseEditingRepository.findCourseById(id, trx);

        const { enabled: isStripeConfigured } = await this.envService.getStripeConfigured();

        if (!updateCourseBody.language) {
          throw new BadRequestException("adminCourseView.toast.updateCourseMissingLanguage");
        }

        if (
          !existingCourse.availableLocales.includes(updateCourseBody.language) &&
          hasLocalizableUpdates(courses, updateCourseBody)
        ) {
          throw new BadRequestException("adminCourseView.toast.languageNotSupported");
        }

        if (!existingCourse) {
          throw new NotFoundException("adminCourseView.errors.notFound.course");
        }

        if (!canUpdateCourseByAuthor(currentUser, existingCourse.authorId)) {
          throw new ForbiddenException("adminCourseView.errors.forbidden.updateCourse");
        }

        const previousSnapshot =
          await this.courseActivitySnapshotService.buildCourseActivitySnapshot(
            id,
            updateCourseBody.language,
            trx,
          );

        if (updateCourseBody.categoryId) {
          const categoryExists = await this.courseEditingRepository.categoryExists(
            updateCourseBody.categoryId,
            trx,
          );

          if (!categoryExists) {
            throw new NotFoundException("adminCourseView.errors.notFound.category");
          }
        }

        const updatedCourse = await this.courseEditingRepository.updateCourseDetails(
          id,
          updateCourseBody,
          { includePrice: isStripeConfigured },
          trx,
        );

        if (!updatedCourse) {
          throw new ConflictException("adminCourseView.errors.update.courseFailed");
        }

        if (updatedCourse.status !== COURSE_STATUSES.PUBLISHED) {
          await this.settingsService.clearFeaturedCoursesIfMatches(id, trx);
        }

        if (!isPlaywrightTest && isStripeConfigured) {
          await this.syncCourseWithStripe(updatedCourse, updateCourseBody, trx);
        }

        const updatedSnapshot =
          await this.courseActivitySnapshotService.buildCourseActivitySnapshot(
            id,
            updateCourseBody.language,
            trx,
          );

        await this.searchIndexService.refreshCourse(id, trx);

        return {
          updatedCourse,
          previousCourseSnapshot: previousSnapshot,
          updatedCourseSnapshot: updatedSnapshot,
        };
      });

    if (updateCourseBody.title) {
      await this.courseSlugService.regenerateCoursesSlugs([id]);
    }

    await this.publishUpdateCourseEventIfChanged(
      id,
      currentUser,
      previousCourseSnapshot,
      updatedCourseSnapshot,
    );

    return updatedCourse;
  }

  async updateCourseMedia(
    id: UUIDType,
    { thumbnailPositionY, language }: UpdateCourseMediaBody,
    currentUser: CurrentUserType,
    image?: Express.Multer.File,
  ) {
    await this.masterCourseService.assertCourseContentEditable(id);

    const authorId = await this.courseEditingRepository.findCourseAuthorId(id);

    if (!authorId) throw new NotFoundException("adminCourseView.errors.notFound.course");

    if (!canUpdateCourseByAuthor(currentUser, authorId)) {
      throw new ForbiddenException("adminCourseView.errors.forbidden.updateCourse");
    }

    const previousCourseSnapshot =
      await this.courseActivitySnapshotService.buildCourseActivitySnapshot(id, language);

    const thumbnailS3Key = image
      ? await this.uploadCourseThumbnail(image, currentUser.tenantId)
      : undefined;

    const updatedCourse = await this.courseEditingRepository.updateCourseMedia(id, {
      thumbnailPositionY,
      ...(thumbnailS3Key && { thumbnailS3Key }),
    });

    if (!updatedCourse) {
      throw new ConflictException("adminCourseView.errors.media.updateFailed");
    }

    const updatedCourseSnapshot =
      await this.courseActivitySnapshotService.buildCourseActivitySnapshot(id, language);

    await this.publishUpdateCourseEventIfChanged(
      id,
      currentUser,
      previousCourseSnapshot,
      updatedCourseSnapshot,
    );

    return updatedCourse;
  }

  async updateHasCertificate(
    courseId: UUIDType,
    hasCertificate: boolean,
    currentUser: CurrentUserType,
  ) {
    const course = await this.courseEditingRepository.findCourseById(courseId);

    if (!course) {
      throw new NotFoundException("adminCourseView.errors.notFound.course");
    }

    if (!canUpdateCourseByAuthor(currentUser, course.authorId)) {
      throw new ForbiddenException("adminCourseView.errors.forbidden.updateCourse");
    }

    const resolvedLanguage = await this.resolveCourseLanguage(courseId);
    const previousSnapshot = await this.courseActivitySnapshotService.buildCourseActivitySnapshot(
      courseId,
      resolvedLanguage,
    );

    const updatedCourse = await this.courseEditingRepository.updateCourseHasCertificate(
      courseId,
      hasCertificate,
    );

    if (hasCertificate) {
      await this.outboxPublisher.publish(
        new UpdateHasCertificateEvent({ courseId, tenantId: currentUser.tenantId }),
      );
    }

    if (!updatedCourse) {
      throw new ConflictException("adminCourseView.errors.update.courseFailed");
    }

    const updatedSnapshot = await this.courseActivitySnapshotService.buildCourseActivitySnapshot(
      courseId,
      resolvedLanguage,
    );

    await this.publishUpdateCourseEventIfChanged(
      courseId,
      currentUser,
      previousSnapshot,
      updatedSnapshot,
    );

    return updatedCourse;
  }

  /** Updates lesson, quiz and certificate settings, enforcing the course type's feature policy. */
  async updateCourseSettings(
    courseId: UUIDType,
    settings: UpdateCourseSettings,
    currentUser: CurrentUserType,
    certificateSignature?: Express.Multer.File | null,
    preparedCertificateSignatureReference?: string,
  ) {
    const attemptedSettingKeys = Object.entries(settings)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);

    if (certificateSignature) attemptedSettingKeys.push("certificateSignature");

    await this.masterCourseService.assertCourseContentEditable(
      courseId,
      CERTIFICATE_SETTING_KEYS,
      attemptedSettingKeys,
    );

    const course = await this.courseEditingRepository.findCourseById(courseId);

    if (!course) {
      throw new NotFoundException("adminCourseView.errors.notFound.course");
    }

    if (!canUpdateCourseByAuthor(currentUser, course.authorId)) {
      throw new ForbiddenException("adminCourseView.errors.forbidden.updateCourse");
    }

    this.assertSettingsAllowedForCourseType(course, settings);

    const resolvedLanguage = await this.resolveCourseLanguage(courseId);
    const previousSnapshot = await this.courseActivitySnapshotService.buildCourseActivitySnapshot(
      courseId,
      resolvedLanguage,
    );

    const incomingSettings = pickBy(
      settings,
      (value, key) =>
        !NON_STORED_SETTING_KEYS.includes(key) && value !== undefined && value !== null,
    ) as Partial<CoursesSettings>;

    if ("certificateValidity" in settings) {
      incomingSettings.certificateValidity = settings.certificateValidity ?? null;
    }

    const certificateSignatureReference = await this.resolveCertificateSignatureReference(
      course,
      settings,
      currentUser,
      certificateSignature,
      preparedCertificateSignatureReference,
    );

    const updatedCourse = await this.courseEditingRepository.updateCourseSettings(courseId, {
      ...course.settings,
      ...incomingSettings,
      certificateSignature: certificateSignatureReference,
    });

    if (!updatedCourse) {
      throw new ConflictException("adminCourseView.errors.update.courseFailed");
    }

    if (
      settings.applyValidityToExistingCertificates &&
      Object.prototype.hasOwnProperty.call(settings, "certificateValidity")
    ) {
      await this.certificatesService.applyValidityToExistingCertificates(
        courseId,
        settings.certificateValidity ?? null,
        currentUser,
      );
    }

    const updatedSnapshot = await this.courseActivitySnapshotService.buildCourseActivitySnapshot(
      courseId,
      resolvedLanguage,
    );

    await this.publishUpdateCourseEventIfChanged(
      courseId,
      currentUser,
      previousSnapshot,
      updatedSnapshot,
    );

    return updatedCourse;
  }

  async getCourseSettings(
    courseId: UUIDType,
  ): Promise<CoursesSettings & { certificateSignatureUrl: string | null }> {
    const course = await this.courseEditingRepository.findCourseById(courseId);

    if (!course) {
      throw new NotFoundException("adminCourseView.errors.notFound.course");
    }

    const certificateSignatureUrl = course.settings.certificateSignature
      ? await this.fileService.getFileUrl(course.settings.certificateSignature, {
          quality: IMAGE_QUALITY.SM,
        })
      : null;

    return {
      ...course.settings,
      videoCompletionTrackingEnabled:
        course.settings.videoCompletionTrackingEnabled ?? VIDEO_COMPLETION_TRACKING_ENABLED,
      certificateSignatureUrl,
    };
  }

  async getCourseSequenceEnabled(courseId: UUIDType): Promise<LessonSequenceEnabledResponse> {
    const course = await this.courseEditingRepository.findCourseById(courseId);

    if (!course) {
      throw new NotFoundException("adminCourseView.errors.notFound.course");
    }

    return { lessonSequenceEnabled: course.settings.lessonSequenceEnabled };
  }

  async deleteCourseTrailer(courseId: UUIDType, currentUser: CurrentUserType) {
    const authorId = await this.courseEditingRepository.findCourseAuthorId(courseId);

    if (!authorId) {
      throw new NotFoundException("adminCourseView.errors.notFound.course");
    }

    if (!canUpdateCourseByAuthor(currentUser, authorId)) {
      throw new ForbiddenException("adminCourseView.errors.forbidden.updateCourse");
    }

    await this.masterCourseService.assertCourseContentEditable(courseId);

    const trailerResourceIds =
      await this.courseEditingRepository.findActiveTrailerResourceIds(courseId);

    await this.fileService.archiveResources(trailerResourceIds);

    return { message: "Course trailer removed successfully" };
  }

  private async resolveCourseLanguage(courseId: UUIDType) {
    const { language } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.COURSE,
      courseId,
    );

    return language;
  }

  private assertSettingsAllowedForCourseType(course: EditedCourse, settings: UpdateCourseSettings) {
    if (settings.lessonSequenceEnabled !== undefined) {
      this.courseFeaturePolicyService.assertFeatureEnabled(
        course.courseType,
        COURSE_FEATURE.LESSON_SEQUENCE_SETTING,
      );
    }

    if (settings.quizFeedbackEnabled !== undefined) {
      this.courseFeaturePolicyService.assertFeatureEnabled(
        course.courseType,
        COURSE_FEATURE.QUIZ_FEEDBACK_SETTING,
      );
    }

    if (settings.videoCompletionTrackingEnabled !== undefined) {
      this.courseFeaturePolicyService.assertFeatureEnabled(
        course.courseType,
        COURSE_FEATURE.VIDEO_COMPLETION_TRACKING_SETTING,
      );
    }
  }

  private async resolveCertificateSignatureReference(
    course: EditedCourse,
    settings: UpdateCourseSettings,
    currentUser: CurrentUserType,
    certificateSignature?: Express.Multer.File | null,
    preparedCertificateSignatureReference?: string,
  ) {
    if (certificateSignature) {
      const { fileKey } = await this.fileService.uploadFile(
        certificateSignature,
        "certificate",
        currentUser.tenantId,
      );

      return settings.removeCertificateSignature ? null : fileKey;
    }

    if (settings.removeCertificateSignature) return null;

    return preparedCertificateSignatureReference ?? course.settings.certificateSignature ?? null;
  }

  private async uploadCourseThumbnail(image: Express.Multer.File, tenantId: UUIDType) {
    try {
      const { fileKey } = await this.fileService.uploadFile(image, ENTITY_TYPES.COURSE, tenantId);

      return fileKey;
    } catch {
      throw new ConflictException("adminCourseView.errors.media.imageUploadFailed");
    }
  }

  private async createStripeProductForNewCourse(
    createCourseBody: CreateCourseBody,
    currency: string,
  ) {
    const { productId, priceId } = await this.stripeService.createProduct({
      name: createCourseBody.title,
      description: createCourseBody?.description ?? "",
      currency,
      amountInCents: createCourseBody?.priceInCents ?? 0,
    });

    if (!productId || !priceId) {
      throw new InternalServerErrorException("adminCourseView.errors.create.stripeProductFailed");
    }

    return { productId, priceId };
  }

  /** Creates the Stripe product on first sync, otherwise updates its name and replaces the price. */
  private async syncCourseWithStripe(
    updatedCourse: EditedCourse,
    updateCourseBody: UpdateCourseBody,
    trx: DatabasePg,
  ) {
    const baseTitle = (updatedCourse.title as Record<string, string>)[updatedCourse.baseLanguage];
    const baseDescription = (updatedCourse.description as Record<string, string>)[
      updatedCourse.baseLanguage
    ];

    if (!updatedCourse.stripeProductId) {
      const { productId, priceId } = await this.stripeService.createProduct({
        name: baseTitle,
        description: baseDescription ?? "",
        amountInCents: updatedCourse.priceInCents ?? 0,
        currency: updatedCourse.currency ?? "usd",
      });

      await this.courseEditingRepository.updateCourseStripeIds(
        updatedCourse.id,
        { stripeProductId: productId, stripePriceId: priceId },
        trx,
      );

      return;
    }

    if (updateCourseBody.language === updatedCourse.baseLanguage) {
      await this.stripeService.updateProduct(updatedCourse.stripeProductId, {
        name: baseTitle,
        description: baseDescription,
      });
    }

    const hasPriceUpdate =
      updateCourseBody.priceInCents !== undefined || updateCourseBody.currency !== undefined;

    if (!updatedCourse.stripePriceId || !hasPriceUpdate) return;

    const pricePayload: Stripe.PriceCreateParams = {
      product: updatedCourse.stripeProductId,
      currency: updateCourseBody.currency ?? "usd",
      ...(updateCourseBody.priceInCents !== undefined && {
        unit_amount: updateCourseBody.priceInCents,
      }),
    };

    const newStripePrice = await this.stripeService.createPrice(pricePayload);

    if (!newStripePrice.id) return;

    await this.stripeService.updatePrice(updatedCourse.stripePriceId, { active: false });
    await this.courseEditingRepository.updateCourseStripeIds(
      updatedCourse.id,
      { stripePriceId: newStripePrice.id },
      trx,
    );
  }

  private async publishUpdateCourseEventIfChanged(
    courseId: UUIDType,
    currentUser: CurrentUserType,
    previousCourseData: CourseActivityLogSnapshot,
    updatedCourseData: CourseActivityLogSnapshot,
  ) {
    if (
      this.courseActivitySnapshotService.areCourseSnapshotsEqual(
        previousCourseData,
        updatedCourseData,
      )
    ) {
      return;
    }

    await this.outboxPublisher.publish(
      new UpdateCourseEvent({
        courseId,
        actor: currentUser,
        previousCourseData,
        updatedCourseData,
      }),
    );
  }
}
