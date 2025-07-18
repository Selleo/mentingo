import { EventsHandler } from "@nestjs/cqrs";
import { NewUserEmail } from "@repo/email-templates";

import { EmailService } from "src/common/emails/emails.service";

import { UserRegisteredEvent } from "../../events/user/user-registered.event";
import { UserService } from "../user.service";

import type { IEventHandler } from "@nestjs/cqrs";

@EventsHandler(UserRegisteredEvent)
export class NotifyAdminsHandler implements IEventHandler<UserRegisteredEvent> {
  constructor(
    private userService: UserService,
    private emailService: EmailService,
  ) {}

  async handle(event: UserRegisteredEvent) {
    const { user } = event;
    const { firstName, lastName, email } = user;

    const { text, html } = new NewUserEmail({
      first_name: firstName,
      last_name: lastName,
      email: email,
    });

    const adminsToNotify = await this.userService.getAdminsToNotifyAboutNewUser();

    await Promise.all(
      adminsToNotify.map((admin) => {
        return this.emailService.sendEmail({
          to: admin.user.email,
          subject: "A new user has registered on your platform",
          text,
          html,
          from: process.env.SES_EMAIL || "",
        });
      }),
    );
  }
}
