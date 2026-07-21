"use client";

// ============================================================================
// RSVPReader — Module 1: RSVP flashing with ORP highlighting, dynamic
// punctuation delay, WPM controls (200–1200), and metric tallying.
// ============================================================================

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronsLeft,
  ChevronsRight,
  Gauge,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Timer,
  TrendingUp,
  Type,
} from "lucide-react";
import { useRSVPReader } from "@/hooks/useRSVPReader";
import { MAX_WPM, MIN_WPM, WPM_STEP } from "@/lib/rsvp";
import type { RSVPMetrics } from "@/lib/types";

export interface RSVPReaderProps {
  /** Plain text extracted from the uploaded PDF. */
  text: string;
  initialWPM?: number;
  /** Persist sprint metrics (e.g. insert into rsvp_sessions) on completion. */
  onSprintComplete?: (metrics: RSVPMetrics) => void;
}

/** Renders a frame with its ORP character fixed at the horizontal center. */
function ORPWord({ text, orpIndex }: { text: string; orpIndex: number }) {
  const before = text.slice(0, orpIndex);
  const orp = text[orpIndex] ?? "";
  const after = text.slice(orpIndex + 1);

  // Two flex-1 halves keep the ORP glyph pinned to the visual center
  // regardless of how long the pre/post segments are.
  return (
    <div className="flex w-full items-baseline font-reader text-5xl tracking-wide">
      <span className="flex-1 text-right text-neutral-100">{before}</span>
      <span className="px-[1px] font-bold text-orp">{orp}</span>
      <span className="flex-1 text-left text-neutral-100">{after}</span>
    </div>
  );
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function RSVPReader({
  text,
  initialWPM = 300,
  onSprintComplete,
}: RSVPReaderProps) {
  const reader = useRSVPReader(text, {
    initialWPM,
    onComplete: onSprintComplete,
  });

  const {
    token,
    progress,
    isPlaying,
    isComplete,
    wpm,
    chunkSize,
    metrics,
    toggle,
    restart,
    skip,
    setWPM,
    setChunkSize,
  } = reader;

  // Keyboard: space = play/pause, arrows = skip / WPM.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          toggle();
          break;
        case "ArrowLeft":
          skip(-5);
          break;
        case "ArrowRight":
          skip(5);
          break;
        case "ArrowUp":
          e.preventDefault();
          setWPM(wpm + WPM_STEP);
          break;
        case "ArrowDown":
          e.preventDefault();
          setWPM(wpm - WPM_STEP);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle, skip, setWPM, wpm]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-2xl bg-surface-raised p-6 shadow-xl">
      {/* ------------------------------------------------ Focal box */}
      <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-surface px-6 py-14">
        {/* Fixation guides above/below the ORP center line */}
        <div className="pointer-events-none absolute left-1/2 top-3 h-4 w-px -translate-x-1/2 bg-orp/70" />
        <div className="pointer-events-none absolute bottom-3 left-1/2 h-4 w-px -translate-x-1/2 bg-orp/70" />

        <AnimatePresence mode="popLayout">
          {token ? (
            <motion.div
              key={`${token.startWordIndex}-${token.text}`}
              initial={{ opacity: 0.15 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.04 }}
            >
              <ORPWord text={token.text} orpIndex={token.orpIndex} />
            </motion.div>
          ) : (
            <p className="text-center text-neutral-500">No text loaded.</p>
          )}
        </AnimatePresence>

        {isComplete && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-x-0 bottom-2 text-center text-sm text-accent-soft"
          >
            Sprint complete — take the comprehension test to log your score.
          </motion.p>
        )}
      </div>

      {/* ------------------------------------------------ Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
        <motion.div
          className="h-full bg-accent"
          animate={{ width: `${progress * 100}%` }}
          transition={{ ease: "linear", duration: 0.1 }}
        />
      </div>

      {/* ------------------------------------------------ Transport controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => skip(-5)}
          className="rounded-lg p-2 text-neutral-400 transition hover:bg-surface-overlay hover:text-white"
          aria-label="Rewind 5 frames"
        >
          <ChevronsLeft size={20} />
        </button>

        <button
          onClick={toggle}
          className="rounded-full bg-accent p-4 text-white shadow-lg transition hover:bg-accent-soft"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause size={22} /> : <Play size={22} className="translate-x-[1px]" />}
        </button>

        <button
          onClick={() => skip(5)}
          className="rounded-lg p-2 text-neutral-400 transition hover:bg-surface-overlay hover:text-white"
          aria-label="Forward 5 frames"
        >
          <ChevronsRight size={20} />
        </button>

        <button
          onClick={restart}
          className="rounded-lg p-2 text-neutral-400 transition hover:bg-surface-overlay hover:text-white"
          aria-label="Restart sprint"
        >
          <RotateCcw size={18} />
        </button>
      </div>

      {/* ------------------------------------------------ WPM + chunk controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Gauge size={16} className="text-accent-soft" />
          <button
            onClick={() => setWPM(wpm - WPM_STEP)}
            className="rounded-md bg-surface-overlay p-1.5 text-neutral-300 hover:text-white"
            aria-label="Decrease WPM"
          >
            <Minus size={14} />
          </button>
          <input
            type="range"
            min={MIN_WPM}
            max={MAX_WPM}
            step={WPM_STEP}
            value={wpm}
            onChange={(e) => setWPM(Number(e.target.value))}
            className="w-40 accent-indigo-500"
            aria-label="Words per minute"
          />
          <button
            onClick={() => setWPM(wpm + WPM_STEP)}
            className="rounded-md bg-surface-overlay p-1.5 text-neutral-300 hover:text-white"
            aria-label="Increase WPM"
          >
            <Plus size={14} />
          </button>
          <span className="w-20 font-mono text-sm text-neutral-200">{wpm} WPM</span>
        </div>

        <div className="flex items-center gap-2">
          <Type size={16} className="text-accent-soft" />
          {([1, 2, 3] as const).map((size) => (
            <button
              key={size}
              onClick={() => setChunkSize(size)}
              className={`rounded-md px-2.5 py-1 text-sm transition ${
                chunkSize === size
                  ? "bg-accent text-white"
                  : "bg-surface-overlay text-neutral-400 hover:text-white"
              }`}
            >
              {size}w
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------ Live metrics tally */}
      <div className="grid grid-cols-3 gap-3 border-t border-neutral-800 pt-4 text-center">
        <div>
          <div className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider text-neutral-500">
            <TrendingUp size={12} /> Effective WPM
          </div>
          <p className="mt-1 font-mono text-xl text-neutral-100">
            {metrics.effectiveWPM || "—"}
          </p>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider text-neutral-500">
            <Type size={12} /> Words consumed
          </div>
          <p className="mt-1 font-mono text-xl text-neutral-100">
            {metrics.wordsConsumed.toLocaleString()}
          </p>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider text-neutral-500">
            <Timer size={12} /> Active time
          </div>
          <p className="mt-1 font-mono text-xl text-neutral-100">
            {formatDuration(metrics.activeMs)}
          </p>
        </div>
      </div>
    </div>
  );
}
