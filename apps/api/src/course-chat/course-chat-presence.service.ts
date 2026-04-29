import { Injectable } from "@nestjs/common";

import type { UUIDType } from "src/common";

type PresenceChange = {
  courseId: UUIDType;
  userId: UUIDType;
  isOnline: boolean;
};

@Injectable()
export class CourseChatPresenceService {
  private readonly courseUsers = new Map<UUIDType, Map<UUIDType, Set<string>>>();
  private readonly socketMemberships = new Map<string, Set<string>>();

  join(courseId: UUIDType, userId: UUIDType, socketId: string): PresenceChange | null {
    const userSockets = this.getUserSockets(courseId, userId);
    const wasOnline = userSockets.size > 0;

    userSockets.add(socketId);
    this.getSocketMemberships(socketId).add(this.getMembershipKey(courseId, userId));

    if (wasOnline) return null;

    return { courseId, userId, isOnline: true };
  }

  leave(courseId: UUIDType, userId: UUIDType, socketId: string): PresenceChange | null {
    const userSockets = this.courseUsers.get(courseId)?.get(userId);
    if (!userSockets?.has(socketId)) return null;

    userSockets.delete(socketId);
    this.socketMemberships.get(socketId)?.delete(this.getMembershipKey(courseId, userId));
    this.cleanupSocket(socketId);

    if (userSockets.size > 0) return null;

    this.courseUsers.get(courseId)?.delete(userId);
    this.cleanupCourse(courseId);

    return { courseId, userId, isOnline: false };
  }

  disconnect(socketId: string): PresenceChange[] {
    const memberships = Array.from(this.socketMemberships.get(socketId) ?? []);
    const changes: PresenceChange[] = [];

    for (const membership of memberships) {
      const [courseId, userId] = membership.split(":") as [UUIDType, UUIDType];
      const change = this.leave(courseId, userId, socketId);
      if (change) changes.push(change);
    }

    this.socketMemberships.delete(socketId);
    return changes;
  }

  isOnline(courseId: UUIDType, userId: UUIDType): boolean {
    return Boolean(this.courseUsers.get(courseId)?.get(userId)?.size);
  }

  private getUserSockets(courseId: UUIDType, userId: UUIDType) {
    let users = this.courseUsers.get(courseId);
    if (!users) {
      users = new Map();
      this.courseUsers.set(courseId, users);
    }

    let sockets = users.get(userId);
    if (!sockets) {
      sockets = new Set();
      users.set(userId, sockets);
    }

    return sockets;
  }

  private getSocketMemberships(socketId: string) {
    let memberships = this.socketMemberships.get(socketId);
    if (!memberships) {
      memberships = new Set();
      this.socketMemberships.set(socketId, memberships);
    }

    return memberships;
  }

  private getMembershipKey(courseId: UUIDType, userId: UUIDType) {
    return `${courseId}:${userId}`;
  }

  private cleanupSocket(socketId: string) {
    const memberships = this.socketMemberships.get(socketId);
    if (memberships && memberships.size === 0) this.socketMemberships.delete(socketId);
  }

  private cleanupCourse(courseId: UUIDType) {
    const users = this.courseUsers.get(courseId);
    if (users && users.size === 0) this.courseUsers.delete(courseId);
  }
}
