// ============================================================================
// Spaced repetition math — expanding intervals t_n ∈ {1, 3, 7, 14, 30} days
// ============================================================================

import {
  REVIEW_INTERVALS_DAYS,
  type ReviewOutcome,
  type ReviewSchedule,
  type ReviewStage,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface GradeResult {
  stage: ReviewStage;
  nextReviewAt: Date;
  lapsed: boolean;
}

/**
 * Advance or regress a review stage given an active-recall outcome.
 *  - recalled: advance one stage (capped at stage 4, which repeats at 30d).
 *  - partial:  hold the current stage; review again after its full interval.
 *  - failed:   regress one stage (floor 0) and review again tomorrow.
 */
export function gradeReview(
  currentStage: ReviewStage,
  outcome: Exclude<ReviewOutcome, "pending">,
  now: Date = new Date()
): GradeResult {
  let stage: ReviewStage;
  let intervalDays: number;
  let lapsed = false;

  switch (outcome) {
    case "recalled":
      stage = Math.min(currentStage + 1, 4) as ReviewStage;
      intervalDays = REVIEW_INTERVALS_DAYS[stage];
      break;
    case "partial":
      stage = currentStage;
      intervalDays = REVIEW_INTERVALS_DAYS[stage];
      break;
    case "failed":
      stage = Math.max(currentStage - 1, 0) as ReviewStage;
      intervalDays = 1;
      lapsed = true;
      break;
  }

  return {
    stage,
    nextReviewAt: new Date(now.getTime() + intervalDays * DAY_MS),
    lapsed,
  };
}

/** First review lands one day after rule creation (stage 0). */
export function initialSchedule(now: Date = new Date()): {
  stage: ReviewStage;
  nextReviewAt: Date;
} {
  return { stage: 0, nextReviewAt: new Date(now.getTime() + DAY_MS) };
}

/** Schedules due now (or overdue), oldest first — the active recall queue. */
export function dueQueue(
  schedules: ReviewSchedule[],
  now: Date = new Date()
): ReviewSchedule[] {
  return schedules
    .filter((s) => new Date(s.next_review_at).getTime() <= now.getTime())
    .sort(
      (a, b) =>
        new Date(a.next_review_at).getTime() -
        new Date(b.next_review_at).getTime()
    );
}

/** Human label for a stage's interval, e.g. "7d". */
export function stageLabel(stage: ReviewStage): string {
  return `${REVIEW_INTERVALS_DAYS[stage]}d`;
}
