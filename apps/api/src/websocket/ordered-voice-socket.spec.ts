import { UseGuards } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from "@nestjs/websockets";
import { VOICE_SOCKET_EVENT } from "@repo/shared";
import { Socket } from "socket.io";
import { io } from "socket.io-client";

import { SessionService } from "src/auth/session/session.service";

import { WsJwtGuard } from "./guards/ws-jwt.guard";
import { OrderedVoiceIoAdapter } from "./ordered-voice-io.adapter";

jest.mock("src/auth/session/session.service", () => ({ SessionService: class {} }));

@WebSocketGateway({ transports: ["websocket"] })
class VoiceProbeGateway {
  readonly received: string[] = [];

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(VOICE_SOCKET_EVENT.AUDIO_CHUNK)
  chunk(@ConnectedSocket() socket: Socket, @MessageBody() data: { seq: number }) {
    this.received.push(`chunk-${data.seq}`);
    socket.emit("probe:received", this.received);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(VOICE_SOCKET_EVENT.CLIENT_SPEECH_END)
  end(@ConnectedSocket() socket: Socket) {
    this.received.push("end");
    socket.emit("probe:received", this.received);
  }

  @SubscribeMessage("probe:barrier")
  barrier() {
    return true;
  }
}

const claims = {
  userId: "synthetic-user",
  sessionId: "synthetic-session",
  sessionVersion: "1",
  tenantId: "synthetic-tenant",
  email: "synthetic@example.invalid",
  roleSlugs: [],
  permissions: [],
};

it.each([false, true])(
  "real Nest/Socket.IO ingress preserves ordering with delayed auth (revoked=%s)",
  async (revoked) => {
    let release: () => void = () => {
      throw new Error("Deferred not initialized");
    };
    const firstAuth = new Promise<void>((resolve) => {
      release = resolve;
    });
    const verify = jest.fn().mockImplementationOnce(async () => {
      await firstAuth;
      return claims;
    });
    if (revoked) verify.mockRejectedValue(new Error("Synthetic session revocation"));
    else verify.mockResolvedValue(claims);
    const module = await Test.createTestingModule({
      providers: [
        VoiceProbeGateway,
        WsJwtGuard,
        { provide: SessionService, useValue: { verifySessionToken: verify } },
      ],
    }).compile();
    const app = module.createNestApplication();
    app.useWebSocketAdapter(new OrderedVoiceIoAdapter(app));
    await app.listen(0, "127.0.0.1");
    const address: unknown = app.getHttpServer().address();
    if (typeof address !== "object" || address === null || !("port" in address)) {
      await app.close();
      throw new Error("No loopback listener");
    }
    const client = io(`http://127.0.0.1:${address.port}`, {
      transports: ["websocket"],
      reconnection: false,
      auth: { token: "synthetic-token" },
    });
    try {
      await new Promise<void>((resolve, reject) => {
        client.once("connect", resolve);
        client.once("connect_error", reject);
      });
      const complete = new Promise<void>((resolve) => {
        if (revoked) client.once("disconnect", () => resolve());
        else
          client.on("probe:received", (received: string[]) => {
            if (received.length === 3) resolve();
          });
      });
      client.emit(VOICE_SOCKET_EVENT.AUDIO_CHUNK, { seq: 1 });
      client.emit(VOICE_SOCKET_EVENT.AUDIO_CHUNK, { seq: 2 });
      client.emit(VOICE_SOCKET_EVENT.CLIENT_SPEECH_END, {});
      await new Promise<void>((resolve) => client.emit("probe:barrier", {}, () => resolve()));
      // The barrier proves all preceding packets reached the server while first auth was blocked.
      expect(verify).toHaveBeenCalledTimes(1);
      release();
      await complete;
      const gateway = module.get(VoiceProbeGateway);
      expect(gateway.received).toEqual(revoked ? ["chunk-1"] : ["chunk-1", "chunk-2", "end"]);
      expect(verify).toHaveBeenCalledTimes(revoked ? 2 : 3);
    } finally {
      release();
      client.close();
      await app.close();
    }
  },
);
