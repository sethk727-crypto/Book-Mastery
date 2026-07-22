"use client";

// ============================================================================
// BookNavigator — chapters (auto-detected table of contents) + full-text
// search drawer for the Sprint Reader. Chapters offer jump-to and
// "Quiz this chapter"; search matches jump to their page or can be saved as
// disconfirming evidence for the Reconsolidation Studio.
// ============================================================================

import { useMemo, useState } from "react";
import {
  BookMarked,
  Brain,
  CheckCircle2,
  HelpCircle,
  ListTree,
  Search,
} from "lucide-react";
import { searchBook, type BookOutline } from "@/lib/chapters";

export const PENDING_EVIDENCE_KEY = "neuro:pending_evidence";

export interface PendingEvidence {
  bookId: string;
  bookTitle: string;
  text: string;
  locator: string;
}

export interface JumpTarget {
  pageIndex: number;
  /** Absolute word index — lets the RSVP stream jump too. */
  wordIndex: number;
}

export interface BookNavigatorProps {
  bookId: string;
  bookTitle: string;
  outline: BookOutline;
  currentPage: number;
  /** Highest word index the reader has reached (for chapter progress). */
  furthestWord: number;
  /** Jump to a position — the reader applies it to whichever mode is active. */
  onJump: (target: JumpTarget) => void;
  /** Launch a comprehension quiz over a chapter's word range. */
  onQuizRange?: (startWord: number, endWord: number) => void;
}

export default function BookNavigator({
  bookId,
  bookTitle,
  outline,
  currentPage,
  furthestWord,
  onJump,
  onQuizRange,
}: BookNavigatorProps) {
  const [tab, setTab] = useState<"chapters" | "search">("chapters");
  const [query, setQuery] = useState("");
  const [savedMatch, setSavedMatch] = useState<number | null>(null);

  const matches = useMemo(() => searchBook(outline, query), [outline, query]);

  const saveAsEvidence = (snippet: string, pageIndex: number, matchIdx: number) => {
    const payload: PendingEvidence = {
      bookId,
      bookTitle,
      text: snippet.replace(/^…|…$/g, ""),
      locator: `${bookTitle}, page ${pageIndex + 1}`,
    };
    try {
      localStorage.setItem(PENDING_EVIDENCE_KEY, JSON.stringify(payload));
      setSavedMatch(matchIdx);
    } catch {
      // storage blocked — nothing saved
    }
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-surface p-4">
      <div className="mb-3 flex gap-1 rounded-lg bg-surface-raised p-1">
        <button
          onClick={() => setTab("chapters")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
            tab === "chapters" ? "bg-accent text-white" : "text-neutral-400 hover:text-white"
          }`}
        >
          <ListTree size={14} /> Chapters
        </button>
        <button
          onClick={() => setTab("search")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
            tab === "search" ? "bg-accent text-white" : "text-neutral-400 hover:text-white"
          }`}
        >
          <Search size={14} /> Search
        </button>
      </div>

      {tab === "chapters" && (
        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {outline.chapters.map((chapter, i) => {
            const isCurrent =
              chapter.pageIndex <= currentPage &&
              (i + 1 >= outline.chapters.length ||
                outline.chapters[i + 1].pageIndex > currentPage);
            const isRead = furthestWord >= chapter.wordIndex + chapter.wordCount;
            return (
              <div
                key={`${chapter.wordIndex}-${i}`}
                className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 ${
                  isCurrent ? "bg-accent/10" : "hover:bg-surface-overlay"
                }`}
              >
                <button
                  onClick={() =>
                    onJump({ pageIndex: chapter.pageIndex, wordIndex: chapter.wordIndex })
                  }
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  {isRead ? (
                    <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
                  ) : (
                    <BookMarked
                      size={13}
                      className={`shrink-0 ${isCurrent ? "text-accent-soft" : "text-neutral-600"}`}
                    />
                  )}
                  <span
                    className={`truncate text-sm ${
                      isCurrent ? "text-white" : "text-neutral-300"
                    }`}
                  >
                    {chapter.title}
                  </span>
                  <span className="shrink-0 text-xs text-neutral-600">
                    p.{chapter.pageIndex + 1} · {chapter.wordCount.toLocaleString()}w
                  </span>
                </button>
                {onQuizRange && chapter.wordCount >= 200 && (
                  <button
                    onClick={() =>
                      onQuizRange(chapter.wordIndex, chapter.wordIndex + chapter.wordCount)
                    }
                    className="flex shrink-0 items-center gap-1 rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-400 transition hover:border-accent hover:text-accent-soft"
                    title="Quiz this chapter"
                  >
                    <HelpCircle size={11} /> Quiz
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "search" && (
        <div className="flex flex-col gap-2">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSavedMatch(null);
            }}
            placeholder="Search the whole book…"
            className="rounded-lg border border-neutral-800 bg-surface-raised p-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-accent"
          />
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {query.trim().length >= 2 && matches.length === 0 && (
              <p className="p-2 text-center text-xs text-neutral-600">No matches.</p>
            )}
            {matches.map((match, i) => (
              <div
                key={`${match.paragraphIndex}-${i}`}
                className="rounded-lg border border-neutral-800 p-2 hover:border-neutral-600"
              >
                <button
                  onClick={() =>
                    onJump({
                      pageIndex: match.pageIndex,
                      wordIndex: outline.paragraphWordStart[match.paragraphIndex] ?? 0,
                    })
                  }
                  className="w-full text-left"
                >
                  <span className="text-xs text-accent-soft">Page {match.pageIndex + 1}</span>
                  <p className="mt-0.5 text-xs leading-relaxed text-neutral-400">
                    {match.snippet}
                  </p>
                </button>
                <button
                  onClick={() => saveAsEvidence(match.snippet, match.pageIndex, i)}
                  className={`mt-1.5 flex items-center gap-1 rounded-md px-2 py-1 text-xs transition ${
                    savedMatch === i
                      ? "bg-emerald-950/50 text-emerald-300"
                      : "bg-surface-overlay text-neutral-400 hover:text-white"
                  }`}
                >
                  <Brain size={11} />
                  {savedMatch === i
                    ? "Saved — open the Reconsolidation Studio to use it"
                    : "Save as disconfirming evidence"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
