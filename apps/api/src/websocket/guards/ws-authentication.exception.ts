import { WsException } from "@nestjs/websockets";

/** Marks a confirmed credential rejection without classifying infrastructure failures as revoked access. */
export class WsAuthenticationException extends WsException {}
