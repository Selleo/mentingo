import { Inject, Injectable } from "@nestjs/common";

import {
  COURSE_CHAT_PRESENCE_TTL_SECONDS,
  getCourseChatPresenceCourseOnlineUsersKey,
  getCourseChatPresenceCourseUserSocketsKey,
  getCourseChatPresenceMembershipKey,
  getCourseChatPresenceSocketMembershipsKey,
} from "src/course-chat/course-chat-presence.keys";
import { REDIS_CLIENT, type RedisClient } from "src/redis";

import type { UUIDType } from "src/common";

@Injectable()
export class CourseChatPresenceStore {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: RedisClient) {}

  async addMembership(courseId: UUIDType, userId: UUIDType, socketId: string): Promise<boolean> {
    const userSocketsKey = getCourseChatPresenceCourseUserSocketsKey(courseId, userId);
    const socketMembershipsKey = getCourseChatPresenceSocketMembershipsKey(socketId);
    const onlineUsersKey = getCourseChatPresenceCourseOnlineUsersKey(courseId);
    const wasOnline = await this.isOnline(courseId, userId);

    await this.redisClient
      .multi()
      .sAdd(userSocketsKey, socketId)
      .sAdd(socketMembershipsKey, getCourseChatPresenceMembershipKey(courseId, userId))
      .sAdd(onlineUsersKey, userId)
      .expire(userSocketsKey, COURSE_CHAT_PRESENCE_TTL_SECONDS)
      .expire(socketMembershipsKey, COURSE_CHAT_PRESENCE_TTL_SECONDS)
      .expire(onlineUsersKey, COURSE_CHAT_PRESENCE_TTL_SECONDS)
      .exec();

    return !wasOnline;
  }

  async removeMembership(courseId: UUIDType, userId: UUIDType, socketId: string): Promise<number> {
    const userSocketsKey = getCourseChatPresenceCourseUserSocketsKey(courseId, userId);
    const socketMembershipsKey = getCourseChatPresenceSocketMembershipsKey(socketId);

    if (!(await this.redisClient.sIsMember(userSocketsKey, socketId))) return -1;

    await this.redisClient
      .multi()
      .sRem(userSocketsKey, socketId)
      .sRem(socketMembershipsKey, getCourseChatPresenceMembershipKey(courseId, userId))
      .expire(socketMembershipsKey, COURSE_CHAT_PRESENCE_TTL_SECONDS)
      .exec();

    const remainingSockets = await this.redisClient.sCard(userSocketsKey);
    if (remainingSockets > 0) {
      await this.redisClient.expire(userSocketsKey, COURSE_CHAT_PRESENCE_TTL_SECONDS);
      return 0;
    }

    await this.redisClient
      .multi()
      .del(userSocketsKey)
      .sRem(getCourseChatPresenceCourseOnlineUsersKey(courseId), userId)
      .exec();

    return 1;
  }

  async getSocketMemberships(socketId: string): Promise<string[]> {
    return this.redisClient.sMembers(getCourseChatPresenceSocketMembershipsKey(socketId));
  }

  async deleteSocketMemberships(socketId: string): Promise<void> {
    await this.redisClient.del(getCourseChatPresenceSocketMembershipsKey(socketId));
  }

  async deleteSocketMembershipsIfEmpty(socketId: string): Promise<void> {
    const socketMembershipsKey = getCourseChatPresenceSocketMembershipsKey(socketId);
    const remainingMemberships = await this.redisClient.sCard(socketMembershipsKey);

    if (remainingMemberships === 0) {
      await this.redisClient.del(socketMembershipsKey);
    }
  }

  async isOnline(courseId: UUIDType, userId: UUIDType): Promise<boolean> {
    return Boolean(
      await this.redisClient.exists(getCourseChatPresenceCourseUserSocketsKey(courseId, userId)),
    );
  }

  async getOnlineUserIds(courseId: UUIDType, userIds: UUIDType[]): Promise<Set<UUIDType>> {
    if (!userIds.length) return new Set();

    const pipeline = this.redisClient.multi();
    userIds.forEach((userId) => {
      pipeline.exists(getCourseChatPresenceCourseUserSocketsKey(courseId, userId));
    });

    const results = await pipeline.exec();

    return new Set(userIds.filter((_, index) => Number(results?.[index]) > 0));
  }
}
