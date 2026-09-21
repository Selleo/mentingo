/**
 * Incrementally projects voice markup v1 onto its display text.
 * Only the reserved ⟦...⟧ namespace is consumed. Every header is hidden,
 * including malformed/unknown headers, while bodies are ordinary display text.
 * Speech validation and bounded say/spell buffering belong to the TTS parser.
 * No header content is retained, so an unterminated header uses constant memory.
 * Escaped openers are emitted once and never reparsed.
 */
export class VoiceMarkupDisplayParser {
  private state: "text" | "opener" | "header" = "text";

  push(chunk: string): string {
    let display = "";
    for (const character of chunk) {
      if (this.state === "header") {
        if (character === "⟧") this.state = "text";
        continue;
      }
      if (this.state === "opener") {
        if (character === "⟦") {
          display += "⟦";
          this.state = "text";
        } else if (character === "⟧") {
          this.state = "text";
        } else {
          this.state = "header";
        }
        continue;
      }
      if (character === "⟦") {
        this.state = "opener";
      } else {
        display += character;
      }
    }
    return display;
  }

  finish(): string {
    // A lone opener or unfinished header is reserved markup, not display.
    this.state = "text";
    return "";
  }
}

/** Decode a complete voice response for persistence; never strip ordinary HTML. */
export function stripVoiceControlTags(text: string): string {
  const parser = new VoiceMarkupDisplayParser();
  return parser.push(text) + parser.finish();
}
