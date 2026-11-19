import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Value } from "@sinclair/typebox/value";

import {
  DISCUSSION_UNSUBSCRIBE_TOKEN_PURPOSE,
  DISCUSSION_UNSUBSCRIBE_TOKEN_TTL,
} from "src/discussion-notifications/discussion-notifications.constants";
import { discussionUnsubscribeClaimsSchema } from "src/discussion-notifications/schemas/discussion-unsubscribe.schema";

import type { DiscussionUnsubscribeClaims } from "src/discussion-notifications/schemas/discussion-unsubscribe.schema";

@Injectable()
export class DiscussionUnsubscribeTokenService {
  constructor(private readonly jwtService: JwtService) {}

  sign(claims: Omit<DiscussionUnsubscribeClaims, "purpose">): Promise<string> {
    return this.jwtService.signAsync(
      { ...claims, purpose: DISCUSSION_UNSUBSCRIBE_TOKEN_PURPOSE },
      { expiresIn: DISCUSSION_UNSUBSCRIBE_TOKEN_TTL },
    );
  }

  async verify(token: string): Promise<DiscussionUnsubscribeClaims | null> {
    try {
      const claims: unknown = await this.jwtService.verifyAsync(token);

      return Value.Check(discussionUnsubscribeClaimsSchema, claims) ? claims : null;
    } catch {
      return null;
    }
  }
}
