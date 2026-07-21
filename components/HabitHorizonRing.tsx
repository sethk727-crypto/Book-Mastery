"use client";

// ============================================================================
// HabitHorizonRing — 66-dot progress ring with single-miss tolerance.
// ============================================================================

import { useMemo } from "react";
import { computeHabitProgress } from "@/lib/habits";
import type { Habit, HabitLog } from "@/lib/types";

export default function HabitHorizonRing({
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
