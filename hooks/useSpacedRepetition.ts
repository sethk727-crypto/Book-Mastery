"use client";

// ============================================================================
// useSpacedRepetition — active recall queue over expanding intervals
// t_n ∈ {1, 3, 7, 14, 30} days, with masked-card grading.
// ============================================================================

import { useCallback, useMemo, useState } from "react";
import { dueQueue, gradeReview } from "@/lib/spacedRepetition";
import type {
  DoctrineRule,
  ReviewOutcome,
  ReviewSchedule,
  ReviewStage,
  UUID,
} from "@/lib/types";

export interface ReviewCard {
  rule: DoctrineRule;
  schedule: ReviewSchedule;
}

export interface UseSpacedRepetitionReturn {
  /** Cards due now, oldest first. */
  queue: ReviewCard[];
  /** The card currently under review, or null when the queue is empty. */
  current: ReviewCard | null;
  /** Whether the current card's rule text is revealed. */
  revealed: boolean;
  reveal: () => void;
  /**
   * Grade the current card. Advances/regresses the stage, computes the next
   * review date, and moves to the next card. Returns the updated schedule so
   * the caller can persist it.
   */
  grade: (outcome: Exclude<ReviewOutcome, "pending">) => ReviewSchedule | null;
  reviewedCount: number;
  remainingCount: number;
  sessionComplete: boolean;
}

export function useSpacedRepetition(
  rules: DoctrineRule[],
  schedules: ReviewSchedule[],
  onScheduleUpdate?: (updated: ReviewSchedule) => void
): UseSpacedRepetitionReturn {
  const [gradedIds, setGradedIds] = useState<Set<UUID>>(new Set());
  const [revealed, setRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [localSchedules, setLocalSchedules] = useState<Map<UUID, ReviewSchedule>>(
    () => new Map()
  );

  const ruleById = useMemo(
    () => new Map(rules.map((r) => [r.id, r])),
    [rules]
  );

  const queue: ReviewCard[] = useMemo(() => {
    const merged = schedules.map((s) => localSchedules.get(s.id) ?? s);
    return dueQueue(merged)
      .filter((s) => !gradedIds.has(s.id))
      .map((s) => ({ schedule: s, rule: ruleById.get(s.doctrine_rule_id)! }))
      .filter((c) => c.rule !== undefined && c.rule.is_active);
  }, [schedules, localSchedules, gradedIds, ruleById]);

  const current = queue[0] ?? null;

  const reveal = useCallback(() => setRevealed(true), []);

  const grade = useCallback(
    (outcome: Exclude<ReviewOutcome, "pending">): ReviewSchedule | null => {
      if (!current) return null;

      const { stage, nextReviewAt, lapsed } = gradeReview(
        current.schedule.stage as ReviewStage,
        outcome
      );

      const updated: ReviewSchedule = {
        ...current.schedule,
        stage,
        next_review_at: nextReviewAt.toISOString(),
        last_outcome: outcome,
        last_reviewed_at: new Date().toISOString(),
        total_reviews: current.schedule.total_reviews + 1,
        total_lapses: current.schedule.total_lapses + (lapsed ? 1 : 0),
      };

      setLocalSchedules((m) => new Map(m).set(updated.id, updated));
      setGradedIds((s) => new Set(s).add(updated.id));
      setReviewedCount((n) => n + 1);
      setRevealed(false);
      onScheduleUpdate?.(updated);
      return updated;
    },
    [current, onScheduleUpdate]
  );

  return {
    queue,
    current,
    revealed,
    reveal,
    grade,
    reviewedCount,
    remainingCount: queue.length,
    sessionComplete: queue.length === 0 && reviewedCount > 0,
  };
}
