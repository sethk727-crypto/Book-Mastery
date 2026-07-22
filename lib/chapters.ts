// ============================================================================
// Chapter engine — heading detection, book outline, and full-text search
// over the extracted text. Everything is derived deterministically from the
// paragraph list so page numbers stay consistent across the app.
// ============================================================================

export const PARAGRAPHS_PER_PAGE = 6;

export interface Chapter {
  title: string;
  paragraphIndex: number;
  /** Absolute word index where the chapter starts. */
  wordIndex: number;
  /** Words in this chapter (to the next chapter or end of book). */
  wordCount: number;
  /** First page (in the paged reader) of this chapter. */
  pageIndex: number;
}

export interface BookOutline {
  paragraphs: string[];
  /** Absolute word index at which each paragraph starts. */
  paragraphWordStart: number[];
  chapters: Chapter[];
  totalWords: number;
  pageCount: number;
}

export interface SearchMatch {
  paragraphIndex: number;
  pageIndex: number;
  /** Snippet with the match roughly centered. */
  snippet: string;
}

function countWords(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

const NUMBER_WORDS =
  "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty";

/** Heuristic: does this paragraph look like a chapter/section heading? */
export function isHeading(paragraph: string): boolean {
  const p = paragraph.trim();
  if (p.length === 0 || p.length > 90) return false;
  // "Chapter 4", "PART II", "Section 3.1", "Chapter Twelve: The Deep Life"
  if (
    new RegExp(
      `^(chapter|part|section|book|lesson|rule|habit|law|step)\\s+(\\d+|[ivxlc]+|${NUMBER_WORDS})\\b`,
      "i"
    ).test(p)
  ) {
    return true;
  }
  // "3. The Reconsolidation Window" / "12.4 Spacing Effects"
  if (/^\d+(\.\d+)*[.)]?\s+\S/.test(p) && p.length < 70 && !/[.!?]$/.test(p)) {
    return true;
  }
  // SHORT ALL-CAPS LINE (classic extracted-PDF heading)
  const wordCount = p.split(/\s+/).length;
  if (
    wordCount <= 8 &&
    p === p.toUpperCase() &&
    /[A-Z]{3}/.test(p) &&
    !/[.!?]$/.test(p)
  ) {
    return true;
  }
  return false;
}

/**
 * Build the outline. If fewer than 2 real headings are detected, synthesize
 * evenly sized "Section N" chapters (~3000 words each) so chapter-based
 * features always work, even on heading-less PDFs.
 */
export function buildOutline(text: string): BookOutline {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const paragraphWordStart: number[] = [];
  let runningWords = 0;
  for (const p of paragraphs) {
    paragraphWordStart.push(runningWords);
    runningWords += countWords(p);
  }
  const totalWords = runningWords;
  const pageCount = Math.max(1, Math.ceil(paragraphs.length / PARAGRAPHS_PER_PAGE));

  let chapters: Chapter[] = [];
  paragraphs.forEach((p, i) => {
    if (isHeading(p)) {
      chapters.push({
        title: p.length > 80 ? `${p.slice(0, 77)}…` : p,
        paragraphIndex: i,
        wordIndex: paragraphWordStart[i],
        wordCount: 0,
        pageIndex: Math.floor(i / PARAGRAPHS_PER_PAGE),
      });
    }
  });

  if (chapters.length < 2) {
    // Synthesize sections every ~3000 words.
    chapters = [];
    const SECTION_WORDS = 3000;
    let nextBoundary = 0;
    let section = 1;
    paragraphs.forEach((_, i) => {
      if (paragraphWordStart[i] >= nextBoundary) {
        chapters.push({
          title: `Section ${section}`,
          paragraphIndex: i,
          wordIndex: paragraphWordStart[i],
          wordCount: 0,
          pageIndex: Math.floor(i / PARAGRAPHS_PER_PAGE),
        });
        section += 1;
        nextBoundary = paragraphWordStart[i] + SECTION_WORDS;
      }
    });
  }

  // Fill word counts from the next chapter's start.
  chapters.forEach((chapter, i) => {
    const end = i + 1 < chapters.length ? chapters[i + 1].wordIndex : totalWords;
    chapter.wordCount = Math.max(0, end - chapter.wordIndex);
  });

  return { paragraphs, paragraphWordStart, chapters, totalWords, pageCount };
}

/** Case-insensitive full-text search with centered snippets. */
export function searchBook(
  outline: BookOutline,
  query: string,
  maxMatches = 40
): SearchMatch[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];

  const matches: SearchMatch[] = [];
  for (let i = 0; i < outline.paragraphs.length && matches.length < maxMatches; i++) {
    const paragraph = outline.paragraphs[i];
    const at = paragraph.toLowerCase().indexOf(needle);
    if (at === -1) continue;
    const start = Math.max(0, at - 60);
    const end = Math.min(paragraph.length, at + needle.length + 60);
    matches.push({
      paragraphIndex: i,
      pageIndex: Math.floor(i / PARAGRAPHS_PER_PAGE),
      snippet:
        (start > 0 ? "…" : "") +
        paragraph.slice(start, end) +
        (end < paragraph.length ? "…" : ""),
    });
  }
  return matches;
}

/** The chapter containing an absolute word index (last one starting <= it). */
export function chapterAtWord(outline: BookOutline, wordIndex: number): Chapter | null {
  let current: Chapter | null = null;
  for (const chapter of outline.chapters) {
    if (chapter.wordIndex <= wordIndex) current = chapter;
    else break;
  }
  return current;
}
