"use client";

// ============================================================================
// RSVPReader — Module 1: RSVP flashing with ORP highlighting, dynamic
// punctuation delay, WPM controls (200–1200), and metric tallying.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronsLeft,
  ChevronsRight,
  Gauge,
  Maximize2,
  Minimize2,
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
  /** Resume: start at the frame containing this word index. */
  startWordIndex?: number;
  /** Persist sprint metrics (e.g. insert into rsvp_sessions) on completion. */
  onSprintComplete?: (metrics: RSVPMetrics) => void;
  /** Fires on pause/completion with the reader's current absolute word index. */
  onPositionChange?: (wordIndex: number) => void;
}

/** Renders a frame with its ORP character fixed at the horizontal center. */
function ORPWord({
  text,
  orpIndex,
  sizeClass = "text-5xl",
}: {
  text: string;
  orpIndex: number;
  sizeClass?: string;
}) {
  const before = text.slice(0, orpIndex);
  const orp = text[orpIndex] ?? "";
  const after = text.slice(orpIndex + 1);

  // Two flex-1 halves keep the ORP glyph pinned to the visual center
  // regardless of how long the pre/post segments are.
  return (
    <div className={`flex w-full items-baseline font-reader tracking-wide ${sizeClass}`}>
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
  startWordIndex = 0,
  onSprintComplete,
  onPositionChange,
}: RSVPReaderProps) {
  const reader = useRSVPReader(text, {
    initialWPM,
    startWordIndex,
    onComplete: onSprintComplete,
  });

  // Report the absolute word position whenever playback stops.
  const { token: currentToken, isPlaying: playing } = reader;
  useEffect(() => {
    if (!playing && currentToken && onPositionChange) {
      onPositionChange(currentToken.startWordIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

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

  // ---- Fullscreen ----------------------------------------------------------
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    void (async () => {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else if (containerRef.current) {
          await containerRef.current.requestFullscreen();
        }
      } catch {
        // Fullscreen blocked (e.g. iPhone Safari) — reader keeps working inline.
      }
    })();
  }, []);

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
        case "f":
        case "F":
          toggleFullscreen();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle, skip, setWPM, wpm, toggleFullscreen]);

  return (
    <div
      ref={containerRef}
      className={`mx-auto flex w-full flex-col bg-surface-raised ${
        isFullscreen
          ? "h-full max-w-none justify-center gap-8 overflow-y-auto px-[8vw] py-8"
          : "max-w-3xl gap-6 rounded-2xl p-6 shadow-xl"
      }`}
    >
      {/* ------------------------------------------------ Focal box */}
      <div
        className={`relative overflow-hidden rounded-xl border border-neutral-800 bg-surface px-6 ${
          isFullscreen ? "py-[16vh]" : "py-14"
        }`}
      >
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
              <ORPWord
                text={token.text}
                orpIndex={token.orpIndex}
                sizeClass={isFullscreen ? "text-6xl md:text-7xl lg:text-8xl" : "text-5xl"}
              />
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

        <button
          onClick={toggleFullscreen}
          className="rounded-lg p-2 text-neutral-400 transition hover:bg-surface-overlay hover:text-white"
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          title={isFullscreen ? "Exit fullscreen (F or Esc)" : "Fullscreen (F)"}
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
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
