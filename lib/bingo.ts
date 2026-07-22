// ============================================================================
// Concept Bingo — extract the most distinctive terms from a stretch of text
// to build a bingo card the reader marks off while reading.
// ============================================================================

const STOPWORDS = new Set(
  (
    "the a an and or but if then than that this these those there here was were be been being is are am " +
    "i you he she it we they them him her his hers its our your their my mine yours theirs ours me us " +
    "to of in on at by for with about against between into through during before after above below from " +
    "up down out off over under again further once not no nor only own same so too very just also as " +
    "do does did doing have has had having will would shall should can could may might must ought " +
    "what which who whom whose when where why how all any both each few more most other some such " +
    "because while until although though since whether either neither however therefore thus hence " +
    "one two three four five first second new old great little much many like get got make made way " +
    "even still yet ever never always often sometimes now well back said say says see seen saw know " +
    "knew known think thought take took taken come came go went gone want wanted use used using " +
    "people person thing things time times day days year years part chapter page book"
  ).split(/\s+/)
);

/**
 * Pick `count` distinctive terms from the text: frequency-scored words that
 * are not stopwords, preferring longer and repeated words. Deterministic for
 * a given text so the card is stable across re-renders.
 */
export function extractBingoTerms(text: string, count = 16): string[] {
  const words = text.toLowerCase().match(/[a-z][a-z'’-]{3,}/g) ?? [];
  const freq = new Map<string, number>();
  for (const raw of words) {
    const w = raw.replace(/^['’-]+|['’-]+$/g, "");
    if (w.length < 4 || STOPWORDS.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }

  const scored = Array.from(freq.entries())
    .map(([word, n]) => ({ word, score: n * Math.min(word.length, 10) }))
    .sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));

  // Avoid near-duplicates (shared 5-char stem: "reading"/"readings").
  const chosen: string[] = [];
  for (const { word } of scored) {
    if (chosen.some((c) => c.slice(0, 5) === word.slice(0, 5))) continue;
    chosen.push(word);
    if (chosen.length === count) break;
  }
  // Pad from remaining scored words if de-duping left us short.
  for (const { word } of scored) {
    if (chosen.length >= count) break;
    if (!chosen.includes(word)) chosen.push(word);
  }
  return chosen;
}

export type BingoLine = number[]; // indexes into a 16-cell (4x4) grid

/** All winning lines for a 4x4 card: rows, columns, both diagonals. */
export const BINGO_LINES: BingoLine[] = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [8, 9, 10, 11],
  [12, 13, 14, 15],
  [0, 4, 8, 12],
  [1, 5, 9, 13],
  [2, 6, 10, 14],
  [3, 7, 11, 15],
  [0, 5, 10, 15],
  [3, 6, 9, 12],
];

export function completedLines(marked: boolean[]): BingoLine[] {
  return BINGO_LINES.filter((line) => line.every((i) => marked[i]));
}
