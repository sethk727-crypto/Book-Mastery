"use client";

// ============================================================================
// ConceptBingo — 4x4 bingo card of distinctive terms from the current page.
// Tap terms as you encounter them while reading; complete rows/columns/
// diagonals to score bingos. Marks persist per book+page in localStorage.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Grid3x3, PartyPopper, RotateCcw } from "lucide-react";
import { completedLines, extractBingoTerms } from "@/lib/bingo";

export interface ConceptBingoProps {
  /** Text of the current page (terms are mined from this). */
  sourceText: string;
  /** Stable key for persistence, e.g. `${bookId}:${pageIndex}`. */
  storageKey: string;
}

const EMPTY_MARKS = Array<boolean>(16).fill(false);

export default function ConceptBingo({ sourceText, storageKey }: ConceptBingoProps) {
  const terms = useMemo(() => extractBingoTerms(sourceText, 16), [sourceText]);
  const [marked, setMarked] = useState<boolean[]>(EMPTY_MARKS);

  const fullKey = `bingo:${storageKey}`;

  // Load saved marks for this page.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(fullKey);
      setMarked(saved ? (JSON.parse(saved) as boolean[]) : EMPTY_MARKS);
    } catch {
      setMarked(EMPTY_MARKS);
    }
  }, [fullKey]);

  const toggle = useCallback(
    (index: number) => {
      setMarked((prev) => {
        const next = [...prev];
        next[index] = !next[index];
        try {
          localStorage.setItem(fullKey, JSON.stringify(next));
        } catch {
          // storage full/blocked — bingo still works for this session
        }
        return next;
      });
    },
    [fullKey]
  );

  const reset = useCallback(() => {
    setMarked(EMPTY_MARKS);
    try {
      localStorage.removeItem(fullKey);
    } catch {
      // ignore
    }
  }, [fullKey]);

  const lines = completedLines(marked);
  const winningCells = new Set(lines.flat());

  if (terms.length < 16) {
    return (
      <p className="rounded-xl border border-neutral-800 bg-surface p-4 text-center text-xs text-neutral-500">
        Not enough distinctive words on this page for a bingo card — turn the page and try again.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-200">
          <Grid3x3 size={14} className="text-accent-soft" />
          Concept Bingo — tap each term when you spot it on this page
        </span>
        <div className="flex items-center gap-3">
          {lines.length > 0 && (
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1 text-xs font-medium text-amber-300"
            >
              <PartyPopper size={13} />
              BINGO ×{lines.length}
            </motion.span>
          )}
          <button
            onClick={reset}
            className="rounded-md p-1 text-neutral-500 hover:text-white"
            aria-label="Reset bingo card"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {terms.map((term, i) => {
          const isMarked = marked[i];
          const isWinning = winningCells.has(i);
          return (
            <button
              key={`${term}-${i}`}
              onClick={() => toggle(i)}
              className={`truncate rounded-lg border px-1.5 py-2.5 text-xs transition ${
                isWinning
                  ? "border-amber-500 bg-amber-500/20 text-amber-200"
                  : isMarked
                    ? "border-accent bg-accent/20 text-white"
                    : "border-neutral-800 bg-surface-raised text-neutral-400 hover:border-neutral-600"
              }`}
              title={term}
            >
              {term}
            </button>
          );
        })}
      </div>
    </div>
  );
}
