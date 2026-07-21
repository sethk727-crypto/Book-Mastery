"use client";

// ============================================================================
// DoctrineQueue — Module 3: Trigger-Based Doctrine Registry (sorted strictly
// by Context Cue) + masked-flashcard active recall queue + 66-day habit ring.
// ============================================================================

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Brain,
  CheckCircle2,
  ChevronDown,
  Eye,
  HelpCircle,
  Layers,
  MessageSquareWarning,
  Target,
  XCircle,
  Zap,
} from "lucide-react";
import { useSpacedRepetition } from "@/hooks/useSpacedRepetition";
import { stageLabel } from "@/lib/spacedRepetition";
import { computeHabitProgress } from "@/lib/habits";
import type {
  DoctrineRule,
  Habit,
  HabitLog,
  ReviewSchedule,
  ReviewStage,
} from "@/lib/types";

export interface DoctrineQueueProps {
  rules: DoctrineRule[];
  schedules: ReviewSchedule[];
  habits?: Habit[];
  habitLogs?: HabitLog[];
  /** Persist an updated review schedule after grading. */
  onScheduleUpdate?: (updated: ReviewSchedule) => void;
}

// ---------------------------------------------------------------------------
// 66-Day Habit Horizon ring
// ---------------------------------------------------------------------------

function HabitHorizonRing({
  habit,
  logs,
}: {
  habit: Habit;
  logs: HabitLog[];
}) {
  const progress = useMemo(
    () => computeHabitProgress(habit, logs),
    [habit, logs]
  );

  const size = 120;
  const center = size / 2;
  const radius = 48;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} role="img" aria-label="66-day habit progress ring">
        {progress.dots.map((dot, i) => {
          const angle = (i / habit.horizon_days) * 2 * Math.PI - Math.PI / 2;
          const cx = center + radius * Math.cos(angle);
          const cy = center + radius * Math.sin(angle);
          const fill =
            dot === "completed" || dot === "today"
              ? "#34d399"
              : dot === "missed"
                ? "#ef4444"
                : dot === "excused"
                  ? "#fbbf24"
                  : "#3f3f46";
          return <circle key={i} cx={cx} cy={cy} r={2.4} fill={fill} />;
        })}
        <text
          x={center}
          y={center - 4}
          textAnchor="middle"
          className="fill-white font-mono"
          fontSize="20"
        >
          {progress.effectiveStreakDays}
        </text>
        <text
          x={center}
          y={center + 14}
          textAnchor="middle"
          className="fill-neutral-500"
          fontSize="10"
        >
          / {habit.horizon_days} days
        </text>
      </svg>
      <div className="text-xs text-neutral-400">
        <p>{progress.completedDays} days completed</p>
        {progress.chainBroken ? (
          <p className="text-red-400">Chain broke — streak recounting</p>
        ) : (
          <p className="text-emerald-400">
            Single-miss tolerance active — one miss won&apos;t reset you
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Masked active-recall flashcard
// ---------------------------------------------------------------------------

function MaskedReviewCard({
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

// ---------------------------------------------------------------------------
// Main registry — grouped and sorted STRICTLY by context cue, never by book.
// ---------------------------------------------------------------------------

export default function DoctrineQueue({
  rules,
  schedules,
  habits = [],
  habitLogs = [],
  onScheduleUpdate,
}: DoctrineQueueProps) {
  const [openCue, setOpenCue] = useState<string | null>(null);

  const byCue = useMemo(() => {
    const groups = new Map<string, DoctrineRule[]>();
    for (const rule of rules.filter((r) => r.is_active)) {
      const list = groups.get(rule.context_cue) ?? [];
      list.push(rule);
      groups.set(rule.context_cue, list);
    }
    // Alphabetical by cue — deliberately NO grouping or ordering by book.
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rules]);

  const habitByRule = useMemo(
    () => new Map(habits.map((h) => [h.doctrine_rule_id, h])),
    [habits]
  );
  const logsByHabit = useMemo(() => {
    const m = new Map<string, HabitLog[]>();
    for (const log of habitLogs) {
      const list = m.get(log.habit_id) ?? [];
      list.push(log);
      m.set(log.habit_id, list);
    }
    return m;
  }, [habitLogs]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      {/* -------------------------------------------- Active recall queue */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-white">
          <Brain size={18} className="text-accent-soft" />
          Active Recall Queue
        </h2>
        <MaskedReviewCard
          rules={rules}
          schedules={schedules}
          onScheduleUpdate={onScheduleUpdate}
        />
      </section>

      {/* -------------------------------------------- Trigger registry */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-white">
          <Target size={18} className="text-accent-soft" />
          Doctrine Registry
          <span className="text-xs font-normal text-neutral-500">
            sorted by trigger, never by book
          </span>
        </h2>

        <div className="flex flex-col gap-2">
          {byCue.length === 0 && (
            <p className="rounded-xl border border-neutral-800 bg-surface p-6 text-center text-sm text-neutral-500">
              No doctrine rules yet. Run a brain dump, then extract
              If&nbsp;[Cue]&nbsp;→&nbsp;Then&nbsp;[Behavior] rules from it.
            </p>
          )}

          {byCue.map(([cue, cueRules]) => {
            const isOpen = openCue === cue;
            return (
              <div
                key={cue}
                className="overflow-hidden rounded-xl border border-neutral-800 bg-surface"
              >
                <button
                  onClick={() => setOpenCue(isOpen ? null : cue)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-surface-overlay"
                >
                  <span className="flex items-center gap-2">
                    <Zap size={14} className="text-amber-400" />
                    <span className="font-medium text-neutral-100">{cue}</span>
                    <span className="text-xs text-neutral-500">
                      {cueRules.length} rule{cueRules.length !== 1 && "s"}
                    </span>
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-neutral-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col gap-4 border-t border-neutral-800 p-4">
                        {cueRules.map((rule) => {
                          const habit = habitByRule.get(rule.id);
                          return (
                            <div key={rule.id} className="flex flex-col gap-3">
                              <p className="font-reader text-neutral-100">
                                <span className="text-neutral-500">If </span>
                                {rule.context_cue}
                                <span className="text-neutral-500"> → then </span>
                                <span className="text-white">{rule.behavior_command}</span>
                              </p>
                              {rule.why_true && (
                                <p className="text-sm text-neutral-400">
                                  <span className="text-neutral-300">Why true: </span>
                                  {rule.why_true}
                                </p>
                              )}
                              {rule.arguing_pair_clash && (
                                <p className="flex items-start gap-1.5 text-sm text-neutral-400">
                                  <MessageSquareWarning
                                    size={14}
                                    className="mt-0.5 shrink-0 text-orange-400"
                                  />
                                  <span>
                                    <span className="text-neutral-300">Clash: </span>
                                    {rule.arguing_pair_clash}
                                  </span>
                                </p>
                              )}
                              {habit && (
                                <HabitHorizonRing
                                  habit={habit}
                                  logs={logsByHabit.get(habit.id) ?? []}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
