"use client";

// ============================================================================
// SprintReader — distraction-free viewer for Step 1 (pure absorption).
// Text selection, copying, highlighting, and the context menu are all
// intentionally disabled: no notes, no highlights, no escape hatches.
// Offers two modes over the extracted text: paged reading and RSVP flow.
// "Finish Book" hands off to the Recall Chamber and locks the book.
// ============================================================================

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  EyeOff,
  Rows3,
  Zap,
} from "lucide-react";
import RSVPReader from "@/components/RSVPReader";
import type { Book, RSVPMetrics } from "@/lib/types";

const PARAGRAPHS_PER_PAGE = 6;

export interface SprintReaderProps {
  book: Book;
  /** Persist sprint metrics from RSVP flow mode. */
  onSprintComplete?: (metrics: RSVPMetrics) => void;
  /** "Finish Book" pressed — lock the PDF and open the Recall Chamber. */
  onFinishBook: () => void;
}

export default function SprintReader({
  book,
  onSprintComplete,
  onFinishBook,
}: SprintReaderProps) {
  const [mode, setMode] = useState<"page" | "rsvp">("page");
  const [pageIndex, setPageIndex] = useState(0);
  const [confirmFinish, setConfirmFinish] = useState(false);

  const paragraphs = useMemo(
    () =>
      (book.extracted_text ?? "")
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean),
    [book.extracted_text]
  );

  const pageCount = Math.max(1, Math.ceil(paragraphs.length / PARAGRAPHS_PER_PAGE));
  const page = paragraphs.slice(
    pageIndex * PARAGRAPHS_PER_PAGE,
    (pageIndex + 1) * PARAGRAPHS_PER_PAGE
  );

  // One suppressor for every annotation/exfiltration vector.
  const suppress = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
  }, []);

  if (!book.extracted_text) {
    return (
      <p className="rounded-xl border border-neutral-800 bg-surface p-6 text-center text-sm text-neutral-500">
        This book has no extracted text yet — upload it again or re-run extraction.
      </p>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {/* ------------------------------------------------ Header / mode switch */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-white">{book.title}</h2>
          <p className="flex items-center gap-1.5 text-xs text-neutral-500">
            <EyeOff size={12} />
            Sprint mode: selection, highlighting, and notes are disabled by design
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-surface-raised p-1">
          <button
            onClick={() => setMode("page")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
              mode === "page" ? "bg-accent text-white" : "text-neutral-400 hover:text-white"
            }`}
          >
            <Rows3 size={14} /> Pages
          </button>
          <button
            onClick={() => setMode("rsvp")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
              mode === "rsvp" ? "bg-accent text-white" : "text-neutral-400 hover:text-white"
            }`}
          >
            <Zap size={14} /> RSVP flow
          </button>
        </div>
      </div>

      {/* ------------------------------------------------ Reading surface */}
      {mode === "rsvp" ? (
        <RSVPReader
          text={book.extracted_text}
          initialWPM={350}
          onSprintComplete={onSprintComplete}
        />
      ) : (
        <div
          // The lockdown: no selection, no copy/cut, no right-click, no drag.
          onCopy={suppress}
          onCut={suppress}
          onContextMenu={suppress}
          onDragStart={suppress}
          className="select-none rounded-2xl border border-neutral-800 bg-surface-raised p-8"
          style={{ WebkitUserSelect: "none", userSelect: "none" }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={pageIndex}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.15 }}
              className="flex min-h-[420px] flex-col gap-5"
            >
              {page.map((paragraph, i) => (
                <p key={i} className="font-reader text-lg leading-relaxed text-neutral-200">
                  {paragraph}
                </p>
              ))}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-between border-t border-neutral-800 pt-4">
            <button
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              disabled={pageIndex === 0}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-neutral-400 transition hover:bg-surface-overlay hover:text-white disabled:opacity-30"
            >
              <ArrowLeft size={15} /> Back
            </button>
            <span className="font-mono text-xs text-neutral-500">
              {pageIndex + 1} / {pageCount}
            </span>
            <button
              onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
              disabled={pageIndex >= pageCount - 1}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-neutral-400 transition hover:bg-surface-overlay hover:text-white disabled:opacity-30"
            >
              Next <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ Finish Book */}
      {!confirmFinish ? (
        <button
          onClick={() => setConfirmFinish(true)}
          className="flex items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/10 py-3 font-medium text-accent-soft transition hover:bg-accent/20"
        >
          <BookOpenCheck size={17} />
          Finish Book
        </button>
      ) : (
        <div className="rounded-xl border border-amber-700/50 bg-amber-950/20 p-4 text-center">
          <p className="mb-3 text-sm text-amber-200">
            Finishing locks this book and opens a blank 10-minute recall editor.
            You will NOT be able to peek back until the dump is submitted.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setConfirmFinish(false)}
              className="rounded-lg bg-surface-overlay px-4 py-2 text-sm text-neutral-300 hover:text-white"
            >
              Keep reading
            </button>
            <button
              onClick={onFinishBook}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-soft"
            >
              Lock it — start free recall
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
