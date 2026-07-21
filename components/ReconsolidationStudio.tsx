"use client";

// ============================================================================
// ReconsolidationStudio — Module 2: Ecker et al. Coherence Framework.
// Juxtaposition modal (Old Model vs. Disconfirming Reality) + 5-hour
// reconsolidation window with 3 mandatory 30-second recall reps.
// ============================================================================

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  Brain,
  CheckCircle2,
  Clock,
  Hourglass,
  Scale,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";
import {
  useReconsolidationTimer,
  RECALL_DURATION_S,
} from "@/hooks/useReconsolidationTimer";
import type { SchemaRewrite } from "@/lib/types";

export interface ReconsolidationStudioProps {
  rewrite: SchemaRewrite;
  /** Persist the window-open transition (status -> 'window_open'). */
  onWindowOpened?: (openedAt: Date) => void;
  /** Persist a completed 30s recall rep. */
  onRepComplete?: (ordinal: 1 | 2 | 3) => void;
  /** Persist window closure (status -> 'window_closed'). */
  onWindowClosed?: () => void;
  onClose?: () => void;
}

export default function ReconsolidationStudio({
  rewrite,
  onWindowOpened,
  onRepComplete,
  onWindowClosed,
  onClose,
}: ReconsolidationStudioProps) {
  const [windowOpenedAt, setWindowOpenedAt] = useState<Date | null>(
    rewrite.window_opened_at ? new Date(rewrite.window_opened_at) : null
  );

  const timer = useReconsolidationTimer({
    windowOpenedAt,
    completedOrdinals: Array.from(
      { length: rewrite.recall_reps_completed },
      (_, i) => i + 1
    ),
    onRepComplete,
    onWindowClosed,
  });

  const openWindow = async () => {
    await timer.requestNotificationPermission();
    const openedAt = new Date();
    setWindowOpenedAt(openedAt);
    onWindowOpened?.(openedAt);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-surface-raised p-6 shadow-2xl"
      >
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-neutral-500 hover:bg-surface-overlay hover:text-white"
            aria-label="Close studio"
          >
            <X size={18} />
          </button>
        )}

        <header className="mb-6 flex items-center gap-3">
          <Brain className="text-accent-soft" size={24} />
          <div>
            <h2 className="text-lg font-semibold text-white">
              Memory Reconsolidation Studio
            </h2>
            <p className="text-sm text-neutral-400">
              Friction: {rewrite.friction_description}
            </p>
          </div>
        </header>

        {/* ---------------------------------------------- Steps 1 & 2: Juxtaposition */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Old Model */}
          <motion.section
            initial={{ x: -16, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="rounded-xl border border-red-900/50 bg-red-950/20 p-5"
          >
            <div className="mb-3 flex items-center gap-2 text-red-400">
              <AlertTriangle size={16} />
              <h3 className="text-sm font-semibold uppercase tracking-wider">
                Old Model (Target Schema)
              </h3>
            </div>
            <blockquote className="font-reader text-lg leading-relaxed text-red-100/90">
              “{rewrite.old_schema ?? "No target schema retrieved yet — complete Step B."}”
            </blockquote>
            {rewrite.old_schema_emotional_charge !== null && (
              <p className="mt-3 text-xs text-red-400/70">
                Emotional charge: {rewrite.old_schema_emotional_charge}/10
              </p>
            )}
          </motion.section>

          {/* Disconfirming Reality */}
          <motion.section
            initial={{ x: 16, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-5"
          >
            <div className="mb-3 flex items-center gap-2 text-emerald-400">
              <BookOpen size={16} />
              <h3 className="text-sm font-semibold uppercase tracking-wider">
                Disconfirming Reality
              </h3>
            </div>
            <blockquote className="font-reader text-lg leading-relaxed text-emerald-100/90">
              “{rewrite.disconfirming_evidence ??
                "No disconfirming evidence extracted yet — complete Step C."}”
            </blockquote>
            {rewrite.evidence_source_locator && (
              <p className="mt-3 text-xs text-emerald-400/70">
                Source: {rewrite.evidence_source_locator}
              </p>
            )}
          </motion.section>
        </div>

        {/* Prediction-error banner */}
        <div className="my-5 flex items-center justify-center gap-2 text-sm text-neutral-400">
          <Scale size={16} className="text-accent-soft" />
          Hold both simultaneously. The mismatch — not the new idea alone — is
          what unlocks the synapse.
        </div>

        {/* ---------------------------------------------- Step 3: Reconsolidation window */}
        {!windowOpenedAt ? (
          <button
            onClick={openWindow}
            disabled={!rewrite.old_schema || !rewrite.disconfirming_evidence}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-4 font-semibold text-white transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Zap size={18} />
            I felt the mismatch — open the 5-hour window
          </button>
        ) : (
          <section className="rounded-xl border border-neutral-800 bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-neutral-300">
                <Hourglass
                  size={16}
                  className={timer.isWindowOpen ? "animate-pulseRing text-accent-soft" : "text-neutral-600"}
                />
                <span className="text-sm font-medium">
                  {timer.isWindowOpen
                    ? "Reconsolidation window open — synapses labile"
                    : "Window closed — synaptic relocking complete"}
                </span>
              </div>
              <span className="font-mono text-2xl tabular-nums text-white">
                {timer.remainingLabel}
              </span>
            </div>

            {/* Window progress */}
            <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-neutral-800">
              <motion.div
                className="h-full bg-gradient-to-r from-accent to-orp"
                animate={{ width: `${timer.windowProgress * 100}%` }}
                transition={{ ease: "linear" }}
              />
            </div>

            {/* Recall reps */}
            <div className="grid gap-3 sm:grid-cols-3">
              {timer.prompts.map((prompt) => {
                const done = prompt.completedAt !== null ||
                  timer.repsCompleted >= prompt.ordinal;
                return (
                  <div
                    key={prompt.ordinal}
                    className={`rounded-lg border p-3 text-sm ${
                      done
                        ? "border-emerald-800 bg-emerald-950/30 text-emerald-300"
                        : prompt.isDue
                          ? "border-accent bg-accent/10 text-accent-soft"
                          : "border-neutral-800 text-neutral-500"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-medium">
                      {done ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                      Rep {prompt.ordinal} / 3
                    </div>
                    <p className="mt-1 text-xs opacity-80">
                      {done
                        ? "Completed"
                        : prompt.isDue
                          ? "Due now — 30s recall"
                          : `Opens ${prompt.scheduledAt.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}`}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Active 30-second rep */}
            <AnimatePresence>
              {timer.activePrompt && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 overflow-hidden"
                >
                  {timer.recallSecondsLeft === null ? (
                    <button
                      onClick={timer.startRecallRep}
                      className="w-full rounded-lg bg-accent py-3 font-medium text-white hover:bg-accent-soft"
                    >
                      Start {RECALL_DURATION_S}-second recall — re-live the NEW
                      model in the friction context
                    </button>
                  ) : (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-accent/40 bg-accent/5 py-4">
                      <span className="font-mono text-4xl tabular-nums text-white">
                        {timer.recallSecondsLeft}
                      </span>
                      <p className="text-sm text-neutral-400">
                        Vividly rehearse acting from the new model…
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step V hint */}
            {timer.allRepsComplete && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/30 p-3 text-sm text-emerald-300">
                <ShieldCheck size={16} />
                All 3 reps complete. After the window closes, run the
                Verification Audit (Step V): probe the old trigger and log
                whether the new response is effortless.
              </div>
            )}
          </section>
        )}
      </motion.div>
    </div>
  );
}
