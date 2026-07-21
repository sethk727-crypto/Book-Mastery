// ============================================================================
// 66-Day Habit Horizon — progress + single-miss tolerance logic
// ============================================================================

import type { Habit, HabitLog } from "./types";

export type HabitDotState = "completed" | "missed" | "excused" | "future" | "today";

export interface HabitProgress {
  /** One entry per horizon day, index 0 = started_on. */
  dots: HabitDotState[];
  completedDays: number;
  /** Days elapsed since start (inclusive of today, capped at horizon). */
  elapsedDays: number;
  /**
   * Single-miss tolerance: an isolated miss does NOT reset progress.
   * Only two consecutive misses break the chain, at which point the
   * effective count restarts from the day after the break.
   */
  effectiveStreakDays: number;
  chainBroken: boolean;
  isComplete: boolean;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function computeHabitProgress(
  habit: Habit,
  logs: HabitLog[],
  today: Date = new Date()
): HabitProgress {
  const start = new Date(`${habit.started_on}T00:00:00Z`);
  const byDate = new Map(logs.map((l) => [l.log_date, l.status]));

  const msPerDay = 24 * 60 * 60 * 1000;
  const todayIso = isoDate(today);
  const elapsedDays = Math.min(
    Math.floor((Date.parse(`${todayIso}T00:00:00Z`) - start.getTime()) / msPerDay) + 1,
    habit.horizon_days
  );

  const dots: HabitDotState[] = [];
  let completedDays = 0;
  let effectiveStreakDays = 0;
  let consecutiveMisses = 0;
  let chainBroken = false;

  for (let i = 0; i < habit.horizon_days; i++) {
    const day = isoDate(new Date(start.getTime() + i * msPerDay));

    if (day > todayIso) {
      dots.push("future");
      continue;
    }

    const status = byDate.get(day);

    if (status === "completed") {
      dots.push(day === todayIso ? "today" : "completed");
      completedDays++;
      effectiveStreakDays++;
      consecutiveMisses = 0;
    } else if (status === "excused") {
      dots.push("excused");
      consecutiveMisses = 0; // excused days neither add nor break
    } else if (day === todayIso) {
      dots.push("today"); // not yet logged — still open
    } else {
      dots.push("missed");
      consecutiveMisses++;
      if (consecutiveMisses >= 2) {
        // Chain break: restart the effective count. Never zero out the
        // historical completed count — the ring keeps its filled dots.
        effectiveStreakDays = 0;
        chainBroken = true;
      }
      // A single isolated miss is tolerated: streak holds.
    }
  }

  return {
    dots,
    completedDays,
    elapsedDays: Math.max(elapsedDays, 0),
    effectiveStreakDays,
    chainBroken,
    isComplete: effectiveStreakDays >= habit.horizon_days,
  };
}
