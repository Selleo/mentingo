import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { LearningTimeRepository } from "src/learning-time/learning-time.repository";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { USER_ROLES } from "src/user/schemas/userRoles";
import { WsGateway } from "src/websocket";

import type { createCache } from "cache-manager";
import type { UUIDType } from "src/common";
import type { LearningTimeJobData } from "src/queue/queue.types";
import type {
  AuthenticatedSocket,
  HeartbeatPayload,
  JoinLessonPayload,
  LeaveLessonPayload,
} from "src/websocket/websocket.types";

type CacheManager = ReturnType<typeof createCache>;
const CACHE_MANAGER = "CACHE_MANAGER";

interface LessonSession {
  lessonId: string;
  courseId: string;
  socketId: string;
  joinedAt: number;
  lastHeartbeat: number;
  accumulatedSeconds: number;
}

const HEARTBEAT_INTERVAL = 10; // seconds
const FLUSH_THRESHOLD = 60; // flush to queue after 60 seconds accumulated
const SESSION_TTL = 10 * 60 * 1000; // 10 minutes

@Injectable()
export class LearningTimeService implements OnModuleInit {
  private readonly logger = new Logger(LearningTimeService.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly learningTimeRepository: LearningTimeRepository,
    private readonly wsGateway: WsGateway,
    @Inject(CACHE_MANAGER) private cacheManager: CacheManager,
  ) {}

  onModuleInit() {
    this.wsGateway.onJoinLesson(this.handleJoinLesson.bind(this));
    this.wsGateway.onLeaveLesson(this.handleLeaveLesson.bind(this));
    this.wsGateway.onHeartbeat(this.handleHeartbeat.bind(this));
    this.wsGateway.onDisconnect(this.handleDisconnect.bind(this));

    this.logger.log("Learning time tracking handlers registered");
  }

  private getSessionKey(userId: string, lessonId: string, socketId: string): string {
    return `learning-session:${userId}:${lessonId}:${socketId}`;
  }

  private async getSession(key: string): Promise<LessonSession | null> {
    return this.cacheManager.get<LessonSession>(key);
  }

  private async saveSession(key: string, session: LessonSession): Promise<void> {
    await this.cacheManager.set(key, session, SESSION_TTL);
  }

  private async deleteSession(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  private getSocketSessionsKey(socketId: string): string {
    return `socket-sessions:${socketId}`;
  }

  private async trackSocketSession(socketId: string, sessionKey: string): Promise<void> {
    const key = this.getSocketSessionsKey(socketId);
    const sessions = (await this.cacheManager.get<string[]>(key)) || [];
    sessions.push(sessionKey);

    await this.cacheManager.set(key, sessions, SESSION_TTL);
  }

  private async untrackSocketSession(socketId: string, sessionKey: string): Promise<void> {
    const key = this.getSocketSessionsKey(socketId);
    const sessions = (await this.cacheManager.get<string[]>(key)) || [];
    const filtered = sessions.filter((s) => s !== sessionKey);

    if (filtered.length > 0) {
      await this.cacheManager.set(key, filtered, SESSION_TTL);
    } else {
      await this.cacheManager.del(key);
    }
  }

  private async handleJoinLesson(
    socket: AuthenticatedSocket,
    payload: JoinLessonPayload,
  ): Promise<void> {
    if (socket.data.user.role !== USER_ROLES.STUDENT) {
      return;
    }

    const userId = socket.data.user.userId;
    const { lessonId, courseId } = payload;
    const sessionKey = this.getSessionKey(userId, lessonId, socket.id);

    const session: LessonSession = {
      lessonId,
      courseId,
      socketId: socket.id,
      joinedAt: Date.now(),
      lastHeartbeat: Date.now(),
      accumulatedSeconds: 0,
    };

    await this.saveSession(sessionKey, session);
    await this.trackSocketSession(socket.id, sessionKey);

    this.logger.debug(`Started learning session for user ${userId} on lesson ${lessonId}`);
  }

  private async handleLeaveLesson(
    socket: AuthenticatedSocket,
    payload: LeaveLessonPayload,
  ): Promise<void> {
    if (socket.data.user.role !== USER_ROLES.STUDENT) {
      return;
    }

    const userId = socket.data.user.userId;
    const { lessonId } = payload;
    const sessionKey = this.getSessionKey(userId, lessonId, socket.id);
    const session = await this.getSession(sessionKey);

    if (session && session.accumulatedSeconds > 0) {
      await this.queueTimeUpdate(userId, lessonId, session.courseId, session.accumulatedSeconds);

      this.logger.debug(
        `Flushed ${session.accumulatedSeconds}s for user ${userId} on lesson ${lessonId}`,
      );
    }

    await this.deleteSession(sessionKey);
    await this.untrackSocketSession(socket.id, sessionKey);
  }

  private async handleHeartbeat(
    socket: AuthenticatedSocket,
    payload: HeartbeatPayload,
  ): Promise<void> {
    if (socket.data.user.role !== USER_ROLES.STUDENT) {
      return;
    }

    const userId = socket.data.user.userId;
    const { lessonId, courseId, isActive } = payload;
    const sessionKey = this.getSessionKey(userId, lessonId, socket.id);
    const session = await this.getSession(sessionKey);

    if (!session) {
      const newSession: LessonSession = {
        lessonId,
        courseId,
        socketId: socket.id,
        joinedAt: Date.now(),
        lastHeartbeat: Date.now(),
        accumulatedSeconds: 0,
      };

      await this.saveSession(sessionKey, newSession);

      return;
    }

    if (isActive) {
      session.accumulatedSeconds += HEARTBEAT_INTERVAL;
      session.lastHeartbeat = Date.now();

      if (session.accumulatedSeconds >= FLUSH_THRESHOLD) {
        await this.queueTimeUpdate(userId, lessonId, courseId, session.accumulatedSeconds);
        session.accumulatedSeconds = 0;

        this.logger.debug(`Flushed ${FLUSH_THRESHOLD}s for user ${userId} on lesson ${lessonId}`);
      }

      await this.saveSession(sessionKey, session);
    } else {
      session.lastHeartbeat = Date.now();

      await this.saveSession(sessionKey, session);
    }
  }

  private async handleDisconnect(socket: AuthenticatedSocket): Promise<void> {
    const userId = socket.data.user.userId;
    const socketSessionsKey = this.getSocketSessionsKey(socket.id);
    const sessionKeys = (await this.cacheManager.get<string[]>(socketSessionsKey)) || [];

    for (const sessionKey of sessionKeys) {
      const session = await this.getSession(sessionKey);

      if (session && session.accumulatedSeconds > 0) {
        await this.queueTimeUpdate(
          userId,
          session.lessonId,
          session.courseId,
          session.accumulatedSeconds,
        );

        this.logger.debug(
          `Flushed ${session.accumulatedSeconds}s on disconnect for user ${userId}`,
        );
      }

      await this.deleteSession(sessionKey);
    }

    await this.cacheManager.del(socketSessionsKey);

    this.logger.debug(`Cleaned up ${sessionKeys.length} sessions on disconnect for user ${userId}`);
  }

  private async queueTimeUpdate(
    userId: string,
    lessonId: string,
    courseId: string,
    seconds: number,
  ): Promise<void> {
    const jobData: LearningTimeJobData = {
      userId,
      lessonId,
      courseId,
      secondsToAdd: seconds,
      timestamp: Date.now(),
    };

    await this.queueService.enqueue(QUEUE_NAMES.LEARNING_TIME, "update-learning-time", jobData, {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    });
  }

  async getLearningTimeStatistics(courseId: UUIDType) {
    const [averagePerLesson, totalPerStudent, courseTotals] = await Promise.all([
      this.learningTimeRepository.getAverageLearningTimePerLesson(courseId),
      this.learningTimeRepository.getTotalLearningTimePerStudent(courseId),
      this.learningTimeRepository.getCourseTotalLearningTime(courseId),
    ]);

    return {
      averagePerLesson,
      totalPerStudent,
      courseTotals,
    };
  }

  async getDetailedLearningTime(courseId: UUIDType) {
    return this.learningTimeRepository.getLearningTimeForCourse(courseId);
  }
}
