import { Injectable } from "@nestjs/common";

import { CourseChatPresenceStore } from "src/course-chat/course-chat-presence.store";

import type { UUIDType } from "src/common";
import type {
  CourseChatPresenceChange,
  CourseChatPresenceMembership,
} from "src/course-chat/course-chat-presence.types";

@Injectable()
export class CourseChatPresenceService {
  constructor(private readonly presenceStore: CourseChatPresenceStore) {}

  async join(
    courseId: UUIDType,
    userId: UUIDType,
    socketId: string,
  ): Promise<CourseChatPresenceChange | null> {
    const becameOnline = await this.presenceStore.addMembership(courseId, userId, socketId);

    if (!becameOnline) return null;

    return { courseId, userId, isOnline: true };
  }

  async leave(
    courseId: UUIDType,
    userId: UUIDType,
    socketId: string,
  ): Promise<CourseChatPresenceChange | null> {
    const becameOffline = await this.removeMembership(courseId, userId, socketId);

    if (becameOffline !== 1) return null;

    await this.cleanupSocketMemberships(socketId);

    return { courseId, userId, isOnline: false };
  }

  async disconnect(socketId: string): Promise<CourseChatPresenceChange[]> {
    const memberships = await this.getSocketMemberships(socketId);
    const changes: CourseChatPresenceChange[] = [];

    for (const membership of memberships) {
      const change = await this.leave(membership.courseId, membership.userId, socketId);
      if (change) changes.push(change);
    }

    await this.presenceStore.deleteSocketMemberships(socketId);

    return changes;
  }

  async isOnline(courseId: UUIDType, userId: UUIDType): Promise<boolean> {
    return Boolean(await this.presenceStore.isOnline(courseId, userId));
  }

  async getOnlineUserIds(courseId: UUIDType, userIds: UUIDType[]): Promise<Set<UUIDType>> {
    if (!userIds.length) return new Set();

    return this.presenceStore.getOnlineUserIds(courseId, userIds);
  }

  private async removeMembership(courseId: UUIDType, userId: UUIDType, socketId: string) {
    return this.presenceStore.removeMembership(courseId, userId, socketId);
  }

  private async getSocketMemberships(socketId: string): Promise<CourseChatPresenceMembership[]> {
    const memberships = await this.presenceStore.getSocketMemberships(socketId);

    return memberships
      .map((membership) => this.parseMembershipKey(membership))
      .filter((membership): membership is CourseChatPresenceMembership => Boolean(membership));
  }

  private async cleanupSocketMemberships(socketId: string) {
    await this.presenceStore.deleteSocketMembershipsIfEmpty(socketId);
  }

  private parseMembershipKey(membershipKey: string): CourseChatPresenceMembership | null {
    const [courseId, userId] = membershipKey.split(":");

    if (!courseId || !userId) return null;

    return { courseId, userId } as CourseChatPresenceMembership;
  }
}
