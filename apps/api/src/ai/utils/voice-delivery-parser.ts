import { Value } from "@sinclair/typebox/value";

import { voiceDeliverySentenceSchema } from "src/ai/schemas/voice-delivery.schema";

import type {
  VoiceDeliveryParserState,
  VoiceDeliveryStringTarget,
} from "./voice-delivery-parser.types";

const FORBIDDEN_CONTROLS = ["⟦cue:", "⟦emotion:"];
const MAX_ENVELOPE_CHARS = 200_000;

/** Decode the SDK envelope before the current sentence closes.
 * A completed validated cue precedes each text prefix. Later malformed output fails
 * the stream; delivered speech cannot be rolled back. Reversed field order buffers
 * that sentence until its cue arrives. JSON syntax never reaches the caller.
 */
export class VoiceDeliveryParser {
  private state: VoiceDeliveryParserState = "root";
  private target: VoiceDeliveryStringTarget = "root-key";
  private value = "";
  private escaped = false;
  private unicode: string | null = null;
  private field: "cue" | "text" = "cue";
  private seen = new Set<string>();
  private cue: string | undefined;
  private text = "";
  private textComplete = false;
  private emitted = "";
  private cueEmitted = false;
  private count = 0;
  private received = 0;
  private output = "";

  /** Retain only bounded sentence and decoder state between provider fragments. */
  feed(fragment: string): string {
    this.received += fragment.length;
    if (this.received > MAX_ENVELOPE_CHARS) this.fail();
    this.output = "";
    for (const character of fragment) {
      if (this.state === "string") this.consumeString(character);
      else if (!/[\t\r\n ]/u.test(character)) this.consumeSyntax(character);
    }
    this.flushText();
    return this.output;
  }

  /** Require the complete strict envelope before normal stream completion. */
  finish(): void {
    if (this.state !== "done" || this.count === 0) this.fail();
  }

  private consumeSyntax(character: string): void {
    switch (this.state) {
      case "root":
        this.expect(character, "{", "root-key");
        break;
      case "root-key":
        this.startString(character, "root-key");
        break;
      case "root-colon":
        this.expect(character, ":", "array");
        break;
      case "array":
        this.expect(character, "[", "first-element");
        break;
      case "first-element":
        if (character === "]") this.state = "root-close";
        else this.startElement(character);
        break;
      case "element":
        this.startElement(character);
        break;
      case "field":
        this.startString(character, "field");
        break;
      case "field-colon":
        this.expect(character, ":", "value");
        break;
      case "value":
        this.startString(character, this.field);
        break;
      case "field-separator":
        if (character === ",") this.state = "field";
        else if (character === "}") this.finishElement();
        else this.fail();
        break;
      case "array-separator":
        if (character === ",") this.state = "element";
        else if (character === "]") this.state = "root-close";
        else this.fail();
        break;
      case "root-close":
        this.expect(character, "}", "done");
        break;
      default:
        this.fail();
    }
  }

  private expect(character: string, expected: string, next: VoiceDeliveryParserState): void {
    if (character !== expected) this.fail();
    this.state = next;
  }

  private startElement(character: string): void {
    this.expect(character, "{", "field");
    if (++this.count > 12) this.fail();
    this.seen.clear();
    this.cue = undefined;
    this.text = "";
    this.textComplete = false;
    this.emitted = "";
    this.cueEmitted = false;
  }

  private startString(character: string, target: VoiceDeliveryStringTarget): void {
    this.expect(character, '"', "string");
    this.target = target;
    this.value = "";
    this.escaped = false;
    this.unicode = null;
  }

  /** Decode escapes only once complete, even when split across provider fragments. */
  private consumeString(character: string): void {
    if (this.unicode !== null) {
      if (!/^[\da-f]$/iu.test(character)) this.fail();
      this.unicode += character;
      if (this.unicode.length === 4) {
        this.append(String.fromCharCode(Number.parseInt(this.unicode, 16)));
        this.unicode = null;
      }
    } else if (this.escaped) {
      this.escaped = false;
      if (character === "u") this.unicode = "";
      else {
        const escapes: Record<string, string> = {
          '"': '"',
          "\\": "\\",
          "/": "/",
          b: "\b",
          f: "\f",
          n: "\n",
          r: "\r",
          t: "\t",
        };
        if (!(character in escapes)) this.fail();
        this.append(escapes[character]);
      }
    } else if (character === "\\") this.escaped = true;
    else if (character === '"') this.finishString();
    else {
      if (character.charCodeAt(0) < 0x20) this.fail();
      this.append(character);
    }
  }

  private append(character: string): void {
    const previous = this.value.charCodeAt(this.value.length - 1);
    const next = character.charCodeAt(0);
    const pendingHigh = previous >= 0xd800 && previous <= 0xdbff;
    const low = next >= 0xdc00 && next <= 0xdfff;
    if (pendingHigh !== low) this.fail();
    this.value += character;
    const limit = this.target === "text" ? 2048 : 128;
    if (this.value.length > limit) this.fail();
    if (this.target === "text") {
      this.text = this.value;
      if (FORBIDDEN_CONTROLS.some((control) => this.text.includes(control))) this.fail();
    }
  }

  private finishString(): void {
    if (/[\uD800-\uDBFF]$/u.test(this.value)) this.fail();
    switch (this.target) {
      case "root-key":
        if (this.value !== "elements") this.fail();
        this.state = "root-colon";
        break;
      case "field":
        if ((this.value !== "cue" && this.value !== "text") || this.seen.has(this.value))
          this.fail();
        this.field = this.value;
        this.seen.add(this.field);
        this.state = "field-colon";
        break;
      case "cue":
        this.cue = this.value.trim();
        if (!this.cue || /[<>\[\]⟦⟧\r\n]/u.test(this.cue)) this.fail();
        this.state = "field-separator";
        break;
      case "text":
        this.textComplete = true;
        this.state = "field-separator";
        break;
    }
    this.flushText();
  }

  /** Withhold reserved-control prefixes and half surrogate pairs until decidable. */
  private flushText(): void {
    if (!this.cue) return;
    let safe = this.text.trim();
    if (!this.textComplete) {
      for (const control of FORBIDDEN_CONTROLS) {
        for (let length = 1; length < control.length; length += 1) {
          if (safe.endsWith(control.slice(0, length))) {
            safe = safe.slice(0, -length);
            break;
          }
        }
      }
      if (/[\uD800-\uDBFF]$/u.test(safe)) safe = safe.slice(0, -1);
      safe = safe.trimEnd();
    }
    if (!safe.startsWith(this.emitted)) this.fail();
    const delta = safe.slice(this.emitted.length);
    if (!delta) return;
    if (!this.cueEmitted) {
      this.output += `⟦cue:${this.cue}⟧`;
      this.cueEmitted = true;
    }
    this.output += delta;
    this.emitted = safe;
  }

  private finishElement(): void {
    if (
      !this.seen.has("cue") ||
      !this.seen.has("text") ||
      !Value.Check(voiceDeliverySentenceSchema, { cue: this.cue, text: this.text }) ||
      !this.text.trim()
    )
      this.fail();
    this.flushText();
    this.output += " ";
    this.state = "array-separator";
  }

  private fail(): never {
    throw new Error("VOICE_DELIVERY_INVALID: invalid sentence stream");
  }
}
