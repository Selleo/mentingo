import { Injectable, BadRequestException, NotFoundException, ForbiddenException, ConflictException, forwardRef, Inject } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { eq } from "drizzle-orm";
import { isEqual } from "lodash";

import { DatabasePg } from "src/common";
import { setJsonbField } from "src/common/helpers/sqlHelpers";
import { EnvService } from "src/env/services/env.service";
import { UpdateCourseEvent } from "src/events";
import { FileService } from "src/file/file.service";
import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { courses, categories } from "src/storage/schema";
import { StripeService } from "src/stripe/stripe.service";
import { USER_ROLES } from "src/user/schemas/userRoles";
import { UserService } from "src/user/user.service";

import type { SupportedLanguages } from "@repo/shared";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { CourseActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";
import type { UpdateCourseBody } from "src/courses/schemas/updateCourse.schema";
import type * as schema from "src/storage/schema";
import type Stripe from "stripe";




@Injectable()
export class UpdateCourseService {
	constructor(@Inject("DB") private readonly db: DatabasePg,private readonly fileService: FileService,
				@Inject(forwardRef(() => UserService)) private readonly userService: UserService,
				private readonly localizationService: LocalizationService,
				private readonly stripeService: StripeService,
						private readonly envService: EnvService,
						private readonly eventBus: EventBus,
			) {}
 async updateCourse(
		 id: UUIDType,
		 updateCourseBody: UpdateCourseBody,
		 currentUser: CurrentUser,
		 isPlaywrightTest: boolean,
		 image?: Express.Multer.File,
	 ) {
		 const { userId: currentUserId, role: currentUserRole } = currentUser;
 
		 const { updatedCourse, previousCourseSnapshot, updatedCourseSnapshot } =
			 await this.db.transaction(async (trx) => {
				 const [existingCourse] = await trx.select().from(courses).where(eq(courses.id, id));
 
				 const { enabled: isStripeConfigured } = await this.envService.getStripeConfigured();
 
				 if (!updateCourseBody.language) {
					 throw new BadRequestException("adminCourseView.toast.updateCourseMissingLanguage");
				 }
 
				 if (!existingCourse.availableLocales.includes(updateCourseBody.language)) {
					 throw new BadRequestException("adminCourseView.toast.languageNotSupported");
				 }
 
				 if (!existingCourse) {
					 throw new NotFoundException("Course not found");
				 }
 
				 if (existingCourse.authorId !== currentUserId && currentUserRole !== USER_ROLES.ADMIN) {
					 throw new ForbiddenException("You don't have permission to update course");
				 }
 
				 const previousSnapshot = await this.buildCourseActivitySnapshot(
					 id,
					 updateCourseBody.language,
					 trx,
				 );
 
				 if (updateCourseBody.categoryId) {
					 const [category] = await trx
						 .select()
						 .from(categories)
						 .where(eq(categories.id, updateCourseBody.categoryId));
 
					 if (!category) {
						 throw new NotFoundException("Category not found");
					 }
				 }
 
				 // TODO: to remove and start use file service
				 let imageKey = undefined;
				 if (image) {
					 try {
						 const fileExtension = image.originalname.split(".").pop();
						 const resource = `courses/${crypto.randomUUID()}.${fileExtension}`;
						 imageKey = await this.fileService.uploadFile(image, resource);
					 } catch (error) {
						 throw new ConflictException("Failed to upload course image");
					 }
				 }
 
				 const { priceInCents, currency, title, description, language, ...rest } = updateCourseBody;
 
				 const updateData = {
					 ...rest,
					 title: setJsonbField(courses.title, language, title),
					 description: setJsonbField(courses.description, language, description),
					 ...(isStripeConfigured ? { priceInCents, currency } : {}),
					 ...(imageKey && { imageUrl: imageKey.fileUrl }),
				 };
 
				 const [updatedCourse] = await trx
					 .update(courses)
					 .set(updateData)
					 .where(eq(courses.id, id))
					 .returning();
 
				 if (!updatedCourse) {
					 throw new ConflictException("Failed to update course");
				 }
 
				 if (!isPlaywrightTest && isStripeConfigured) {
					 // --- create stripe product if it doesn't exist yet ---
					 if (!updatedCourse.stripeProductId) {
						 const { productId, priceId } = await this.stripeService.createProduct({
							 name: (updatedCourse.title as Record<string, string>)[updatedCourse.baseLanguage],
							 description:
								 (updatedCourse.description as Record<string, string>)[updatedCourse.baseLanguage] ??
								 "",
							 amountInCents: updatedCourse.priceInCents ?? 0,
							 currency: updatedCourse.currency ?? "usd",
						 });
 
						 await trx
							 .update(courses)
							 .set({
								 stripeProductId: productId,
								 stripePriceId: priceId,
							 })
							 .where(eq(courses.id, id));
					 } else {
						 // --- stripe product update ---
						 if (updateCourseBody.language === updatedCourse.baseLanguage) {
							 const productUpdatePayload = {
								 name: (updatedCourse.title as Record<string, string>)[updatedCourse.baseLanguage],
								 description: (updatedCourse.description as Record<string, string>)[
									 updatedCourse.baseLanguage
								 ],
							 };
 
							 await this.stripeService.updateProduct(
								 updatedCourse.stripeProductId,
								 productUpdatePayload,
							 );
						 }
 
						 // --- stripe price update ---
						 const hasPriceUpdate =
							 updateCourseBody.priceInCents !== undefined ||
							 updateCourseBody.currency !== undefined;
 
						 if (updatedCourse.stripePriceId && hasPriceUpdate) {
							 const pricePayload: Stripe.PriceCreateParams = {
								 product: updatedCourse.stripeProductId,
								 currency: updateCourseBody.currency ?? "usd",
								 ...(updateCourseBody.priceInCents !== undefined && {
									 unit_amount: updateCourseBody.priceInCents,
								 }),
							 };
 
							 const newStripePrice = await this.stripeService.createPrice(pricePayload);
 
							 if (newStripePrice.id) {
								 await this.stripeService.updatePrice(updatedCourse.stripePriceId, {
									 active: false,
								 });
 
								 await trx
									 .update(courses)
									 .set({ stripePriceId: newStripePrice.id })
									 .where(eq(courses.id, id));
							 }
						 }
					 }
				 }
 
				 const updatedSnapshot = await this.buildCourseActivitySnapshot(id, language, trx);
 
				 return {
					 updatedCourse,
					 previousCourseSnapshot: previousSnapshot,
					 updatedCourseSnapshot: updatedSnapshot,
				 };
			 });
 
		 if (this.areCourseSnapshotsEqual(previousCourseSnapshot, updatedCourseSnapshot)) {
			 return updatedCourse;
		 }
 
		 this.eventBus.publish(
			 new UpdateCourseEvent({
				 courseId: id,
				 actor: currentUser,
				 previousCourseData: previousCourseSnapshot,
				 updatedCourseData: updatedCourseSnapshot,
			 }),
		 );
 
		 return updatedCourse;
	 }   

	 private async buildCourseActivitySnapshot(
			 courseId: UUIDType,
			 language?: SupportedLanguages,
			 dbInstance: PostgresJsDatabase<typeof schema> = this.db,
		 ): Promise<CourseActivityLogSnapshot> {
			 const {
				 language: resolvedLanguage,
				 baseLanguage,
				 availableLocales,
			 } = await this.localizationService.getBaseLanguage(ENTITY_TYPE.COURSE, courseId, language);
	 
			 const [course] = await dbInstance
				 .select({
					 id: courses.id,
					 title: this.localizationService.getLocalizedSqlField(courses.title, resolvedLanguage),
					 description: this.localizationService.getLocalizedSqlField(
						 courses.description,
						 resolvedLanguage,
					 ),
					 status: courses.status,
					 priceInCents: courses.priceInCents,
					 currency: courses.currency,
					 hasCertificate: courses.hasCertificate,
					 isScorm: courses.isScorm,
					 categoryId: courses.categoryId,
					 authorId: courses.authorId,
					 thumbnailS3Key: courses.thumbnailS3Key,
					 settings: courses.settings,
					 stripeProductId: courses.stripeProductId,
					 stripePriceId: courses.stripePriceId,
				 })
				 .from(courses)
				 .where(eq(courses.id, courseId));
	 
			 if (!course) throw new NotFoundException("Course not found");
	 
			 return {
				 ...course,
				 baseLanguage,
				 availableLocales: Array.isArray(availableLocales) ? availableLocales : [availableLocales],
			 };
		 }
		 private areCourseSnapshotsEqual(
				 previousSnapshot: CourseActivityLogSnapshot | null,
				 updatedSnapshot: CourseActivityLogSnapshot | null,
			 ) {
				 return isEqual(previousSnapshot, updatedSnapshot);
			 }
}
