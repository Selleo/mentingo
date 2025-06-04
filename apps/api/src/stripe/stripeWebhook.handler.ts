import { StripeWebhookHandler as StripeWebhookHandlerDecorator } from "@golevelup/nestjs-stripe";
import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

import { DatabasePg } from "src/common";
import { CourseService } from "src/courses/course.service";
import { courses, users } from "src/storage/schema";

@Injectable()
export class StripeWebhookHandler {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    readonly courseService: CourseService,
  ) {}

  @StripeWebhookHandlerDecorator("payment_intent.succeeded")
  async handlePaymentIntentSucceeded(event: Stripe.Event) {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const userId = paymentIntent.metadata.customerId;
    const courseId = paymentIntent.metadata.courseId;

    if (!userId && !courseId) return null;

    const [user] = await this.db.select().from(users).where(eq(users.id, userId));

    if (!user) return null;

    const [course] = await this.db.select().from(courses).where(eq(courses.id, courseId));

    if (!course) return null;

    try {
      await this.courseService.enrollCourse(courseId, userId, paymentIntent.id);

      return true;
    } catch (error) {
      console.log(error);
      return null;
    }
  }
}
