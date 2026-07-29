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
  Palette,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sunrise,
  Timer,
  TrendingUp,
  Type,
  Vibrate,
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

// ---------------------------------------------------------------------------
// Word themes — glow presets in the spirit of kinetic-typography titles.
// ---------------------------------------------------------------------------

export type WordThemeKey = "classic" | "aurora" | "gold" | "neon" | "violet" | "ember";

interface WordTheme {
  label: string;
  fontClass: string;
  wordStyle?: React.CSSProperties;
  orpStyle?: React.CSSProperties;
  wordClass: string;
  orpClass: string;
}

function glow(color: string): string {
  return `0 0 14px ${color}88, 0 0 42px ${color}55, 0 0 90px ${color}2e`;
}

export const WORD_THEMES: Record<WordThemeKey, WordTheme> = {
  classic: {
    label: "Classic",
    fontClass: "font-reader tracking-wide",
    wordClass: "text-neutral-100",
    orpClass: "font-bold text-orp",
  },
  aurora: {
    // Placeholder — the live color is computed per frame in auroraThemeAt().
    label: "Aurora (cycling)",
    fontClass: "font-sans font-extrabold tracking-tight",
    wordClass: "",
    orpClass: "",
  },
  gold: {
    label: "Gold glow",
    fontClass: "font-sans font-extrabold tracking-tight",
    wordStyle: { color: "#fde047", textShadow: glow("#facc15") },
    orpStyle: { color: "#ffffff", textShadow: glow("#facc15") },
    wordClass: "",
    orpClass: "",
  },
  neon: {
    label: "Neon cyan",
    fontClass: "font-sans font-extrabold tracking-tight",
    wordStyle: { color: "#67e8f9", textShadow: glow("#22d3ee") },
    orpStyle: { color: "#ffffff", textShadow: glow("#22d3ee") },
    wordClass: "",
    orpClass: "",
  },
  violet: {
    label: "Violet glow",
    fontClass: "font-sans font-extrabold tracking-tight",
    wordStyle: { color: "#c4b5fd", textShadow: glow("#8b5cf6") },
    orpStyle: { color: "#ffffff", textShadow: glow("#8b5cf6") },
    wordClass: "",
    orpClass: "",
  },
  ember: {
    label: "Ember",
    fontClass: "font-sans font-extrabold tracking-tight",
    wordStyle: { color: "#fdba74", textShadow: glow("#f97316") },
    orpStyle: { color: "#ffffff", textShadow: glow("#f97316") },
    wordClass: "",
    orpClass: "",
  },
};

const THEME_ORDER: WordThemeKey[] = [
  "classic",
  "aurora",
  "gold",
  "neon",
  "violet",
  "ember",
];

// Aurora: drift through a warm-to-cool palette, changing every few words.
const AURORA_COLORS = [
  "#fde047", // gold
  "#6ee7b7", // mint
  "#67e8f9", // cyan
  "#93c5fd", // sky
  "#c4b5fd", // violet
  "#f9a8d4", // pink
  "#fdba74", // amber
];
const AURORA_HOLD_FRAMES = 5; // frames per color before drifting to the next

function auroraThemeAt(frameIndex: number): WordTheme {
  const color =
    AURORA_COLORS[
      Math.floor(frameIndex / AURORA_HOLD_FRAMES) % AURORA_COLORS.length
    ];
  return {
    label: "Aurora (cycling)",
    fontClass: "font-sans font-extrabold tracking-tight",
    wordStyle: {
      color,
      textShadow: glow(color),
      transition: "color 0.3s ease, text-shadow 0.3s ease",
    },
    orpStyle: { color: "#ffffff", textShadow: glow(color) },
    wordClass: "",
    orpClass: "",
  };
}

// ---------------------------------------------------------------------------
// Sky scenes — atmospheric backdrops built from the brand palette
// (sunrise → midnight). Used behind the word inline and in fullscreen.
// ---------------------------------------------------------------------------

export type SceneKey = "midnight" | "dawn" | "day" | "sunset" | "night";

interface Scene {
  label: string;
  background: string;
  /** Color of the soft ambient glow that breathes behind the word. */
  glow: string;
}

export const SCENES: Record<SceneKey, Scene> = {
  midnight: {
    label: "Midnight",
    background: "radial-gradient(120% 90% at 50% 115%, #1C2541 0%, #0B132B 65%)",
    glow: "#1D2D50",
  },
  dawn: {
    label: "Dawn",
    background:
      "linear-gradient(180deg, #0B132B 0%, #1D2D50 30%, #7B2CBF 56%, #FF8A65 82%, #FFC857 100%)",
    glow: "#FFC857",
  },
  day: {
    label: "Clear sky",
    background:
      "linear-gradient(180deg, #1D2D50 0%, #3A86FF 55%, #87CEEB 85%, #DCEEFA 100%)",
    glow: "#DCEEFA",
  },
  sunset: {
    label: "Sunset",
    background:
      "linear-gradient(180deg, #0B132B 0%, #1C2541 26%, #7B2CBF 50%, #D9381E 76%, #F06543 92%, #FFC857 100%)",
    glow: "#F06543",
  },
  night: {
    label: "Night",
    background: "linear-gradient(180deg, #0B132B 0%, #1D2D50 55%, #1C2541 100%)",
    glow: "#E2C0FF",
  },
};

const SCENE_ORDER: SceneKey[] = ["midnight", "dawn", "day", "sunset", "night"];

/** Slow breathing glow low in the sky — the scene's "light source". */
function SceneGlow({ scene }: { scene: Scene }) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      style={{
        background: `radial-gradient(55% 42% at 50% 80%, ${scene.glow}55 0%, transparent 70%)`,
      }}
      animate={{ opacity: [0.35, 0.75, 0.35] }}
      transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

/** Renders a frame with its ORP character fixed at the horizontal center. */
function ORPWord({
  text,
  orpIndex,
  sizeClass = "text-5xl",
  theme,
}: {
  text: string;
  orpIndex: number;
  sizeClass?: string;
  theme: WordTheme;
}) {
  const before = text.slice(0, orpIndex);
  const orp = text[orpIndex] ?? "";
  const after = text.slice(orpIndex + 1);

  // Two flex-1 halves keep the ORP glyph pinned to the visual center
  // regardless of how long the pre/post segments are.
  return (
    <div className={`flex w-full items-baseline ${theme.fontClass} ${sizeClass}`}>
      <span
        className={`flex-1 text-right ${theme.wordClass}`}
        style={theme.wordStyle}
      >
        {before}
      </span>
      <span className={`px-[1px] ${theme.orpClass}`} style={theme.orpStyle}>
        {orp}
      </span>
      <span className={`flex-1 text-left ${theme.wordClass}`} style={theme.wordStyle}>
        {after}
      </span>
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
    tokenIndex,
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
  // "native" uses the Fullscreen API; "overlay" is the fallback for browsers
  // that don't allow it (iPhone Safari): a fixed element covering the viewport.
  const containerRef = useRef<HTMLDivElement>(null);
  const [fsMode, setFsMode] = useState<"off" | "native" | "overlay">("off");
  const isFullscreen = fsMode !== "off";

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) {
        setFsMode((m) => (m === "native" ? "off" : m));
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    void (async () => {
      if (fsMode === "overlay") {
        setFsMode("off");
        return;
      }
      if (fsMode === "native") {
        try {
          await document.exitFullscreen();
        } catch {
          // listener will sync state; force it anyway
        }
        setFsMode("off");
        return;
      }
      // Entering: try native first, fall back to the overlay (iOS).
      const el = containerRef.current as
        | (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> })
        | null;
      try {
        if (el?.requestFullscreen) {
          await el.requestFullscreen();
          setFsMode("native");
          return;
        }
        if (el?.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
          setFsMode("native");
          return;
        }
      } catch {
        // fall through to overlay
      }
      setFsMode("overlay");
    })();
  }, [fsMode]);

  // ---- Word style: glow theme + micro-shake (persisted) --------------------
  const [themeKey, setThemeKey] = useState<WordThemeKey>("classic");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("rsvp:theme") as WordThemeKey | null;
      if (saved && WORD_THEMES[saved]) setThemeKey(saved);
      setShake(localStorage.getItem("rsvp:shake") === "1");
    } catch {
      // storage blocked — defaults stand
    }
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeKey((prev) => {
      const next = THEME_ORDER[(THEME_ORDER.indexOf(prev) + 1) % THEME_ORDER.length];
      try {
        localStorage.setItem("rsvp:theme", next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const toggleShake = useCallback(() => {
    setShake((prev) => {
      try {
        localStorage.setItem("rsvp:shake", prev ? "0" : "1");
      } catch {
        // ignore
      }
      return !prev;
    });
  }, []);

  // ---- Sky scene (persisted) -----------------------------------------------
  const [sceneKey, setSceneKey] = useState<SceneKey>("midnight");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("rsvp:scene") as SceneKey | null;
      if (saved && SCENES[saved]) setSceneKey(saved);
    } catch {
      // defaults stand
    }
  }, []);
  const cycleScene = useCallback(() => {
    setSceneKey((prev) => {
      const next = SCENE_ORDER[(SCENE_ORDER.indexOf(prev) + 1) % SCENE_ORDER.length];
      try {
        localStorage.setItem("rsvp:scene", next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);
  const scene = SCENES[sceneKey];

  const theme =
    themeKey === "aurora" ? auroraThemeAt(tokenIndex) : WORD_THEMES[themeKey];

  // Focus emphasis: sentence-enders, paragraph breaks, and long/rare words
  // land slightly larger so the eye registers them as landmarks.
  const emphasized = Boolean(
    token &&
      (token.delayMultiplier >= 2 ||
        token.text.replace(/[^A-Za-z'’]/g, "").length >= 9)
  );

  // Micro-shake: a tiny 2px jolt as each new word lands.
  const wordAnimate = {
    opacity: 1,
    scale: emphasized ? 1.12 : 1,
    x: shake ? [2, -2, 1, 0] : 0,
  };
  const wordTransition = { duration: shake ? 0.12 : 0.06 };

  // Overlay mode: lock page scroll behind the overlay and exit on Escape.
  useEffect(() => {
    if (fsMode !== "overlay") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFsMode("off");
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [fsMode]);

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

  // ---- Fullscreen: pure black, word only, tiny corner stats ---------------
  if (isFullscreen) {
    return (
      <div
        ref={containerRef}
        className={fsMode === "overlay" ? "fixed inset-0 z-[100]" : "h-full w-full"}
      >
        <div
          className="relative flex h-full w-full cursor-pointer flex-col items-center justify-center overflow-hidden"
          style={{ background: scene.background }}
          onClick={toggle}
        >
          <SceneGlow scene={scene} />
          {/* Exit — top left (touch-friendly; phones have no Esc key) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            className="absolute left-4 top-4 rounded-lg p-2.5 text-neutral-600 transition hover:text-white"
            aria-label="Exit fullscreen"
          >
            <Minimize2 size={18} />
          </button>
          {/* Small stats — top right */}
          <div className="absolute right-5 top-4 select-none text-right font-mono text-xs leading-relaxed text-neutral-600">
            <div>{wpm} WPM set</div>
            <div>{metrics.effectiveWPM || "—"} effective</div>
            <div>{metrics.wordsConsumed.toLocaleString()} words</div>
            <div>{formatDuration(metrics.activeMs)}</div>
            <div>{Math.round(progress * 100)}%</div>
          </div>

          {/* Fixation ticks + the word */}
          <div className="relative w-full px-[6vw]">
            <div className="pointer-events-none absolute -top-10 left-1/2 h-5 w-px -translate-x-1/2 bg-orp/60" />
            <div className="pointer-events-none absolute -bottom-10 left-1/2 h-5 w-px -translate-x-1/2 bg-orp/60" />
            <AnimatePresence mode="popLayout">
              {token && (
                <motion.div
                  key={`${token.startWordIndex}-${token.text}`}
                  initial={{ opacity: 0.15 }}
                  animate={wordAnimate}
                  exit={{ opacity: 0 }}
                  transition={wordTransition}
                >
                  <ORPWord
                    text={token.text}
                    orpIndex={token.orpIndex}
                    sizeClass="text-6xl md:text-7xl lg:text-8xl"
                    theme={theme}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {isComplete && (
            <p className="absolute bottom-20 px-4 text-center text-sm text-accent-soft">
              Sprint complete — exit fullscreen to take the quiz.
            </p>
          )}
          {!isPlaying && !isComplete && (
            <p className="absolute bottom-20 select-none text-xs text-neutral-600">
              paused — tap anywhere or press space
            </p>
          )}

          {/* Keyboard hints — bottom left (desktop only) */}
          <div className="absolute bottom-4 left-5 hidden select-none font-mono text-[11px] text-neutral-700 sm:block">
            space play · ↑ ↓ speed · ← → skip · F / esc exit
          </div>

          {/* Touch controls — bottom right: theme, shake, speed */}
          <div
            className="absolute bottom-3 right-4 flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={cycleTheme}
              className="rounded-lg bg-neutral-900 p-2.5 text-neutral-500 transition hover:text-white"
              aria-label="Change word color theme"
              title={`Theme: ${theme.label}`}
            >
              <Palette size={16} />
            </button>
            <button
              onClick={cycleScene}
              className="rounded-lg bg-neutral-900 p-2.5 text-neutral-500 transition hover:text-white"
              aria-label="Change sky scene"
              title={`Scene: ${scene.label}`}
            >
              <Sunrise size={16} />
            </button>
            <button
              onClick={toggleShake}
              className={`rounded-lg bg-neutral-900 p-2.5 transition hover:text-white ${
                shake ? "text-accent-soft" : "text-neutral-500"
              }`}
              aria-label="Toggle micro-shake"
              title="Micro-shake"
            >
              <Vibrate size={16} />
            </button>
            <button
              onClick={() => setWPM(wpm - WPM_STEP)}
              className="rounded-lg bg-neutral-900 p-2.5 text-neutral-500 transition hover:text-white"
              aria-label="Slower"
            >
              <Minus size={16} />
            </button>
            <span className="w-14 select-none text-center font-mono text-xs text-neutral-600">
              {wpm}
            </span>
            <button
              onClick={() => setWPM(wpm + WPM_STEP)}
              className="rounded-lg bg-neutral-900 p-2.5 text-neutral-500 transition hover:text-white"
              aria-label="Faster"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Hairline progress bar */}
          <div
            className="absolute bottom-0 left-0 h-0.5 bg-accent transition-[width] duration-100 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-2xl bg-surface-raised p-6 shadow-xl"
    >
      {/* ------------------------------------------------ Focal box */}
      <div
        className="relative overflow-hidden rounded-xl border border-neutral-800 px-6 py-14"
        style={{ background: scene.background }}
      >
        <SceneGlow scene={scene} />
        {/* Fixation guides above/below the ORP center line */}
        <div className="pointer-events-none absolute left-1/2 top-3 h-4 w-px -translate-x-1/2 bg-orp/70" />
        <div className="pointer-events-none absolute bottom-3 left-1/2 h-4 w-px -translate-x-1/2 bg-orp/70" />

        <AnimatePresence mode="popLayout">
          {token ? (
            <motion.div
              key={`${token.startWordIndex}-${token.text}`}
              initial={{ opacity: 0.15 }}
              animate={wordAnimate}
              exit={{ opacity: 0 }}
              transition={wordTransition}
            >
              <ORPWord text={token.text} orpIndex={token.orpIndex} theme={theme} />
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
          <span className="mx-1 h-4 w-px bg-neutral-800" />
          <button
            onClick={cycleTheme}
            className="rounded-md bg-surface-overlay p-1.5 text-neutral-400 transition hover:text-white"
            aria-label="Change word color theme"
            title={`Theme: ${theme.label} (click to cycle)`}
          >
            <Palette size={14} />
          </button>
          <button
            onClick={cycleScene}
            className="rounded-md bg-surface-overlay p-1.5 text-neutral-400 transition hover:text-white"
            aria-label="Change sky scene"
            title={`Scene: ${scene.label} (click to cycle)`}
          >
            <Sunrise size={14} />
          </button>
          <button
            onClick={toggleShake}
            className={`rounded-md bg-surface-overlay p-1.5 transition hover:text-white ${
              shake ? "text-accent-soft" : "text-neutral-400"
            }`}
            aria-label="Toggle micro-shake"
            title="Micro-shake on each word"
          >
            <Vibrate size={14} />
          </button>
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
