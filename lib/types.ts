// ============================================================================
// Shared domain types — mirror supabase/schema.sql
// ============================================================================

export type UUID = string;

// ---------------------------------------------------------------------------
// Module 1 — RSVP
// ---------------------------------------------------------------------------

export type BookStatus = "uploaded" | "processing" | "ready" | "archived";

export interface Book {
  id: UUID;
  user_id: UUID;
  title: string;
  author: string | null;
  status: BookStatus;
  storage_path: string | null;
  extracted_text: string | null;
  word_count: number;
  last_page_index: number;
  last_word_index: number;
  created_at: string;
  updated_at: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface RSVPSessionRecord {
  id: UUID;
  user_id: UUID;
  book_id: UUID;
  started_at: string;
  ended_at: string | null;
  start_word_index: number;
  end_word_index: number | null;
  words_consumed: number;
  active_ms: number;
  avg_wpm: number | null;
  peak_wpm: number | null;
  chunk_size: 1 | 2 | 3;
  created_at: string;
}

export interface RSVPMetrics {
  wordsConsumed: number;
  activeMs: number;
  /** Effective WPM computed from active reading time only. */
  effectiveWPM: number;
  /** History of (timestampMs, wpmSetting) pairs for the sprint. */
  wpmHistory: Array<{ atMs: number; wpm: number }>;
  peakWPM: number;
}

// ---------------------------------------------------------------------------
// Module 2 — Memory Reconsolidation (Ecker et al. Coherence Framework)
// ---------------------------------------------------------------------------

export type RewriteStatus =
  | "friction_logged"
  | "schema_retrieved"
  | "evidence_extracted"
  | "juxtaposed"
  | "window_open"
  | "window_closed"
  | "verified"
  | "relapsed";

export interface SchemaRewrite {
  id: UUID;
  user_id: UUID;
  book_id: UUID | null;
  status: RewriteStatus;
  friction_description: string;
  old_schema: string | null;
  old_schema_emotional_charge: number | null;
  disconfirming_evidence: string | null;
  evidence_source_locator: string | null;
  juxtaposed_at: string | null;
  window_opened_at: string | null;
  window_closes_at: string | null;
  recall_reps_required: number;
  recall_reps_completed: number;
  verified_at: string | null;
  verification_notes: string | null;
  permanence_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface RecallPrompt {
  id: UUID;
  schema_rewrite_id: UUID;
  ordinal: 1 | 2 | 3;
  scheduled_at: string;
  completed_at: string | null;
  duration_seconds: number;
}

// ---------------------------------------------------------------------------
// Module 3 — Absorption & Doctrine
// ---------------------------------------------------------------------------

export interface BrainDump {
  id: UUID;
  user_id: UUID;
  book_id: UUID;
  markdown_body: string;
  started_at: string;
  submitted_at: string | null;
  duration_seconds: number;
  word_count: number;
}

export interface DoctrineRule {
  id: UUID;
  user_id: UUID;
  book_id: UUID | null;
  brain_dump_id: UUID | null;
  context_cue: string;
  behavior_command: string;
  why_true: string;
  arguing_pair_clash: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ReviewOutcome = "pending" | "recalled" | "partial" | "failed";

/** Expanding review intervals in days, indexed by stage. */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30] as const;
export type ReviewStage = 0 | 1 | 2 | 3 | 4;

export interface ReviewSchedule {
  id: UUID;
  doctrine_rule_id: UUID;
  user_id: UUID;
  stage: ReviewStage;
  next_review_at: string;
  last_outcome: ReviewOutcome;
  last_reviewed_at: string | null;
  total_reviews: number;
  total_lapses: number;
}

export type HabitDayStatus = "completed" | "missed" | "excused";

export interface Habit {
  id: UUID;
  user_id: UUID;
  doctrine_rule_id: UUID;
  started_on: string; // ISO date
  horizon_days: number;
  completed_at: string | null;
  abandoned_at: string | null;
}

export interface HabitLog {
  id: UUID;
  habit_id: UUID;
  user_id: UUID;
  log_date: string; // ISO date
  status: HabitDayStatus;
  note: string | null;
}
