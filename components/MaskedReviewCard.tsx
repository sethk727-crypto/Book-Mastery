"use client";

// ============================================================================
// MaskedReviewCard — active-recall flashcard: the context cue is visible,
// the behavior command stays masked until the user retrieves it from memory.
// ============================================================================

import { motion } from "framer-motion";
import {
  CheckCircle2,
  Eye,
  HelpCircle,
  Layers,
  XCircle,
  Zap,
} from "lucide-react";
import { useSpacedRepetition } from "@/hooks/useSpacedRepetition";
import { stageLabel } from "@/lib/spacedRepetition";
import type { DoctrineRule, ReviewSchedule, ReviewStage } from "@/lib/types";

export default function MaskedReviewCard({
  rules,
  schedules,
  onScheduleUpdate,
}: {
  rules: DoctrineRule[];
  schedules: ReviewSchedule[];
  onScheduleUpdate?: (updated: ReviewSchedule) => void;
}) {
  const sr = useSpacedRepetition(rules, schedules, onScheduleUpdate);

  if (!sr.current) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-surface p-6 text-center text-sm text-neutral-400">
        {sr.sessionComplete ? (
          <span className="flex items-center justify-center gap-2 text-emerald-400">
            <CheckCircle2 size={16} />
            Review session complete — {sr.reviewedCount} rules retrieved.
          </span>
        ) : (
          "No rules due for review. The queue refills on the expanding 1 / 3 / 7 / 14 / 30-day schedule."
        )}
      </div>
    );
  }

  const { rule, schedule } = sr.current;

  return (
    <motion.div
      key={rule.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-accent/30 bg-surface p-6"
    >
      <div className="mb-4 flex items-center justify-between text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <Layers size={12} />
          Stage {schedule.stage} ({stageLabel(schedule.stage as ReviewStage)} interval)
        </span>
        <span>{sr.remainingCount} due</span>
      </div>

      {/* The context cue is always visible — it is the retrieval trigger. */}
      <div className="mb-4 flex items-center gap-2">
        <Zap size={16} className="text-amber-400" />
        <span className="rounded-full bg-amber-400/10 px-3 py-1 text-sm font-medium text-amber-300">
          {rule.context_cue}
        </span>
      </div>

      {!sr.revealed ? (
        <>
          {/* Mask: force active retrieval BEFORE showing the rule. */}
          <p className="mb-4 font-reader text-lg text-neutral-200">
            When this cue fires, what is your behavior command?
          </p>
          <button
            onClick={sr.reveal}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-700 py-6 text-neutral-500 transition hover:border-accent hover:text-accent-soft"
          >
            <Eye size={16} />
            Retrieve it from memory first — then reveal
          </button>
        </>
      ) : (
        <>
          <p className="mb-2 font-reader text-xl text-white">
            → {rule.behavior_command}
          </p>
          {rule.why_true && (
            <p className="mb-4 text-sm text-neutral-400">
              <span className="font-medium text-neutral-300">Why true: </span>
              {rule.why_true}
            </p>
          )}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => sr.grade("failed")}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-red-950/50 py-2.5 text-sm text-red-300 hover:bg-red-900/50"
            >
              <XCircle size={14} /> Blank
            </button>
            <button
              onClick={() => sr.grade("partial")}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-950/50 py-2.5 text-sm text-amber-300 hover:bg-amber-900/50"
            >
              <HelpCircle size={14} /> Fuzzy
            </button>
            <button
              onClick={() => sr.grade("recalled")}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-950/50 py-2.5 text-sm text-emerald-300 hover:bg-emerald-900/50"
            >
              <CheckCircle2 size={14} /> Instant
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}
