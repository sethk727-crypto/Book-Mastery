// ============================================================================
// RSVP core math — tokenization, ORP calculation, punctuation delay weights
// ============================================================================

export interface RSVPToken {
  /** The words displayed in this frame (1–3 words joined by a space). */
  text: string;
  /** Index of the ORP character within `text` (highlighted red). */
  orpIndex: number;
  /** Multiplier applied to the base frame duration (1.0 = no delay). */
  delayMultiplier: number;
  /** How many source words this frame consumes. */
  wordCount: number;
  /** Index of the first source word of this frame. */
  startWordIndex: number;
}

/**
 * Optimal Recognition Point index for a single word (Spritz-style).
 * Empirically the eye fixates slightly left of center:
 *   1 char  -> 0
 *   2–5     -> 1
 *   6–9     -> 2
 *   10–13   -> 3
 *   14+     -> 4
 * Leading punctuation (quotes, brackets) is skipped so the ORP lands on a
 * letter whenever possible.
 */
export function computeORPIndex(word: string): number {
  const leading = word.match(/^[^A-Za-z0-9]*/)?.[0].length ?? 0;
  const core = word.slice(leading).replace(/[^A-Za-z0-9'’-]+$/g, "");
  const len = core.length;

  let orp: number;
  if (len <= 1) orp = 0;
  else if (len <= 5) orp = 1;
  else if (len <= 9) orp = 2;
  else if (len <= 13) orp = 3;
  else orp = 4;

  return Math.min(leading + orp, Math.max(word.length - 1, 0));
}

/** Delay multiplier from the trailing punctuation of a frame's final word. */
export function punctuationDelay(word: string, endsParagraph: boolean): number {
  if (endsParagraph) return 2.6;
  if (/[.!?]["'”’)]?$/.test(word)) return 2.1; // sentence end
  if (/[;:]["'”’)]?$/.test(word)) return 1.7;
  if (/,["'”’)]?$/.test(word)) return 1.45;
  if (/[—–-]$/.test(word)) return 1.3;
  if (word.length >= 12) return 1.25; // long-word fixation cost
  return 1.0;
}

/**
 * Tokenize raw text into RSVP frames of `chunkSize` (1–3) words.
 * Paragraph breaks (blank lines) inject an extended pause on the frame that
 * precedes them and always terminate a chunk early so a chunk never spans
 * a paragraph boundary.
 */
export function tokenizeForRSVP(text: string, chunkSize: 1 | 2 | 3): RSVPToken[] {
  const paragraphs = text
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);

  const tokens: RSVPToken[] = [];
  let globalWordIndex = 0;

  for (let p = 0; p < paragraphs.length; p++) {
    const words = paragraphs[p].split(" ").filter(Boolean);

    for (let i = 0; i < words.length; ) {
      const chunk: string[] = [];
      // A sentence-ending word terminates the chunk so pauses land correctly.
      while (chunk.length < chunkSize && i < words.length) {
        const w = words[i];
        chunk.push(w);
        i++;
        if (/[.!?;:]["'”’)]?$/.test(w)) break;
      }

      const isLastChunkOfParagraph = i >= words.length;
      const endsParagraph = isLastChunkOfParagraph && p < paragraphs.length - 1;
      const frameText = chunk.join(" ");
      const lastWord = chunk[chunk.length - 1];

      // ORP anchors on the first word of the chunk (the fixation point).
      const orpIndex = computeORPIndex(chunk[0]);

      tokens.push({
        text: frameText,
        orpIndex,
        delayMultiplier: punctuationDelay(lastWord, endsParagraph),
        wordCount: chunk.length,
        startWordIndex: globalWordIndex,
      });
      globalWordIndex += chunk.length;
    }
  }

  return tokens;
}

/** Milliseconds a frame stays on screen at a given WPM setting. */
export function frameDurationMs(token: RSVPToken, wpm: number): number {
  const baseMsPerWord = 60_000 / wpm;
  return baseMsPerWord * token.wordCount * token.delayMultiplier;
}

export const MIN_WPM = 200;
export const MAX_WPM = 1200;
export const WPM_STEP = 50;

export function clampWPM(wpm: number): number {
  return Math.min(MAX_WPM, Math.max(MIN_WPM, wpm));
}
