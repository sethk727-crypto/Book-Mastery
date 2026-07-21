"use client";

// ============================================================================
// DailyLiturgy — the daily dashboard: serves today's due doctrine rules on
// the 1 → 3 → 7 → 14 → 30 day schedule (masked active recall) and tracks
// every active habit against the 66-day horizon with one-tap check-ins.
// ============================================================================

import { useMemo } from "react";
import { CalendarCheck2, CheckCircle2, Flame, MinusCircle, Sun } from "lucide-react";
import HabitHorizonRing from "@/components/HabitHorizonRing";
import MaskedReviewCard from "@/components/MaskedReviewCard";
import { dueQueue } from "@/lib/spacedRepetition";
import type {
  DoctrineRule,
  Habit,
  HabitDayStatus,
  HabitLog,
  ReviewSchedule,
} from "@/lib/types";

export interface DailyLiturgyProps {
  rules: DoctrineRule[];
  schedules: ReviewSchedule[];
  habits: Habit[];
  habitLogs: HabitLog[];
  /** Persist a graded review to review_schedules. */
  onScheduleUpdate?: (updated: ReviewSchedule) => void;
  /** Persist today's habit check-in to habit_logs. */
  onHabitLog?: (habitId: string, status: HabitDayStatus) => void;
}

export default function DailyLiturgy({
  rules,
  schedules,
  habits,
  habitLogs,
  onScheduleUpdate,
  onHabitLog,
}: DailyLiturgyProps) {
  const dueCount = useMemo(() => dueQueue(schedules).length, [schedules]);
  const todayIso = new Date().toISOString().slice(0, 10);

  const ruleById = useMemo(() => new Map(rules.map((r) => [r.id, r])), [rules]);
  const logsByHabit = useMemo(() => {
    const m = new Map<string, HabitLog[]>();
    for (const log of habitLogs) {
      const list = m.get(log.habit_id) ?? [];
      list.push(log);
      m.set(log.habit_id, list);
    }
    return m;
  }, [habitLogs]);

  const activeHabits = habits.filter((h) => !h.completed_at && !h.abandoned_at);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex items-center gap-3">
        <Sun size={22} className="text-amber-400" />
        <div>
          <h2 className="text-lg font-semibold text-white">Daily Liturgy</h2>
          <p className="text-sm text-neutral-400">
            {dueCount} rule{dueCount !== 1 && "s"} due for retrieval ·{" "}
            {activeHabits.length} habit{activeHabits.length !== 1 && "s"} on the
            66-day horizon
          </p>
        </div>
      </header>

      {/* -------------------------------------------- Review queue */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <CalendarCheck2 size={15} className="text-accent-soft" />
          Today&apos;s retrieval queue
        </h3>
        <MaskedReviewCard
          rules={rules}
          schedules={schedules}
          onScheduleUpdate={onScheduleUpdate}
        />
      </section>

      {/* -------------------------------------------- Habit check-ins */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Flame size={15} className="text-orange-400" />
          Habit horizon check-in
        </h3>

        {activeHabits.length === 0 ? (
          <p className="rounded-xl border border-neutral-800 bg-surface p-6 text-center text-sm text-neutral-500">
            No active habits. Promote a doctrine rule to a 66-day habit from
            the Living Doctrine hub.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {activeHabits.map((habit) => {
              const rule = ruleById.get(habit.doctrine_rule_id);
              const logs = logsByHabit.get(habit.id) ?? [];
              const loggedToday = logs.some((l) => l.log_date === todayIso);

              return (
                <div
                  key={habit.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-neutral-800 bg-surface p-4"
                >
                  <div className="min-w-0 flex-1">
                    {rule && (
                      <p className="mb-2 truncate font-reader text-neutral-100">
                        <span className="text-neutral-500">If </span>
                        {rule.context_cue}
                        <span className="text-neutral-500"> → </span>
                        {rule.behavior_command}
                      </p>
                    )}
                    <HabitHorizonRing habit={habit} logs={logs} />
                  </div>

                  {loggedToday ? (
                    <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                      <CheckCircle2 size={15} /> Logged today
                    </span>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => onHabitLog?.(habit.id, "completed")}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-950/50 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-900/50"
                      >
                        <CheckCircle2 size={14} /> Done today
                      </button>
                      <button
                        onClick={() => onHabitLog?.(habit.id, "excused")}
                        className="flex items-center gap-1.5 rounded-lg bg-amber-950/50 px-4 py-2 text-sm text-amber-300 hover:bg-amber-900/50"
                      >
                        <MinusCircle size={14} /> Excuse
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
