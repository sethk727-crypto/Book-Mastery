// ============================================================================
// Gamification — XP, levels, titles, and achievement badges, all derived
// from data the app already records (no extra tables needed).
// ============================================================================

export interface LearnerStats {
  totalWords: number;
  sprints: number;
  minutes: number;
  peakWPM: number;
  streakDays: number;
  quizzes: number;
  perfectQuizzes: number;
  avgScore: number;
  rules: number;
  reviewsDone: number;
  habitChecks: number;
  dumps: number;
  rewrites: number;
}

export const EMPTY_STATS: LearnerStats = {
  totalWords: 0,
  sprints: 0,
  minutes: 0,
  peakWPM: 0,
  streakDays: 0,
  quizzes: 0,
  perfectQuizzes: 0,
  avgScore: 0,
  rules: 0,
  reviewsDone: 0,
  habitChecks: 0,
  dumps: 0,
  rewrites: 0,
};

// ---------------------------------------------------------------------------
// XP — every kind of learning work pays, deeper work pays more.
// ---------------------------------------------------------------------------

export function computeXP(s: LearnerStats): number {
  return Math.round(
    s.totalWords * 0.1 + // reading volume
      s.sprints * 20 + // showing up
      s.quizzes * 30 + // testing yourself
      s.perfectQuizzes * 50 + // acing it
      s.rules * 80 + // converting reading into doctrine
      s.reviewsDone * 15 + // spaced retrieval
      s.habitChecks * 25 + // behavior change
      s.dumps * 100 + // free recall (hardest, worth most per unit)
      s.rewrites * 120 + // schema rewrites
      s.streakDays * 10 // consistency
  );
}

/** XP needed to *reach* a level (cumulative). Level 1 starts at 0. */
export function xpForLevel(level: number): number {
  return 200 * (level - 1) * (level - 1);
}

export function levelFromXP(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export const LEVEL_TITLES = [
  "Page Curious", // 1
  "Word Wanderer", // 2
  "Steady Sprinter", // 3
  "Focus Apprentice", // 4
  "Chapter Hunter", // 5
  "Recall Cadet", // 6
  "Doctrine Smith", // 7
  "Schema Bender", // 8
  "Velocity Scholar", // 9
  "Memory Architect", // 10
  "Synapse Surgeon", // 11
  "NeuroAbsorber", // 12+
] as const;

export function titleForLevel(level: number): string {
  return LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length) - 1];
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export interface Badge {
  id: string;
  name: string;
  description: string;
  /** Lucide icon name rendered by the UI. */
  icon: string;
  earned: (s: LearnerStats) => boolean;
  /** Short hint shown while locked. */
  hint: string;
}

export const BADGES: Badge[] = [
  { id: "ignition", name: "Ignition", description: "Completed your first sprint.", icon: "Zap", earned: (s) => s.sprints >= 1, hint: "Finish one RSVP sprint" },
  { id: "words-10k", name: "Ten Thousand", description: "Read 10,000 words.", icon: "BookOpen", earned: (s) => s.totalWords >= 10_000, hint: "Read 10k words" },
  { id: "words-100k", name: "Six Figures", description: "Read 100,000 words.", icon: "Library", earned: (s) => s.totalWords >= 100_000, hint: "Read 100k words" },
  { id: "words-1m", name: "Millionaire", description: "Read 1,000,000 words.", icon: "Crown", earned: (s) => s.totalWords >= 1_000_000, hint: "Read 1M words" },
  { id: "speed-600", name: "Speed Demon", description: "Hit 600+ WPM in a sprint.", icon: "Gauge", earned: (s) => s.peakWPM >= 600, hint: "Sprint at 600 WPM" },
  { id: "speed-900", name: "Light Reader", description: "Hit 900+ WPM in a sprint.", icon: "Rocket", earned: (s) => s.peakWPM >= 900, hint: "Sprint at 900 WPM" },
  { id: "quiz-first", name: "Self-Tested", description: "Took a comprehension quiz.", icon: "HelpCircle", earned: (s) => s.quizzes >= 1, hint: "Take one quiz" },
  { id: "quiz-perfect", name: "Total Recall", description: "Scored 100% on a quiz.", icon: "Award", earned: (s) => s.perfectQuizzes >= 1, hint: "Score 100% on a quiz" },
  { id: "quiz-10", name: "Examiner", description: "Took 10 quizzes.", icon: "GraduationCap", earned: (s) => s.quizzes >= 10, hint: "Take 10 quizzes" },
  { id: "streak-3", name: "Warming Up", description: "3-day reading streak.", icon: "Flame", earned: (s) => s.streakDays >= 3, hint: "Read 3 days in a row" },
  { id: "streak-7", name: "On Fire", description: "7-day reading streak.", icon: "Flame", earned: (s) => s.streakDays >= 7, hint: "Read 7 days in a row" },
  { id: "streak-30", name: "Unstoppable", description: "30-day reading streak.", icon: "Trophy", earned: (s) => s.streakDays >= 30, hint: "Read 30 days in a row" },
  { id: "rule-first", name: "Lawmaker", description: "Forged your first doctrine rule.", icon: "Scale", earned: (s) => s.rules >= 1, hint: "Create one If→Then rule" },
  { id: "rule-10", name: "Doctrine Architect", description: "10 doctrine rules in the registry.", icon: "Landmark", earned: (s) => s.rules >= 10, hint: "Create 10 rules" },
  { id: "review-50", name: "Memory Smith", description: "Completed 50 spaced reviews.", icon: "Brain", earned: (s) => s.reviewsDone >= 50, hint: "Complete 50 reviews" },
  { id: "habit-21", name: "Habit Forger", description: "21 habit check-ins.", icon: "CheckCircle2", earned: (s) => s.habitChecks >= 21, hint: "Check in 21 habit days" },
  { id: "habit-66", name: "66-Day Finisher", description: "66 habit check-ins — a full horizon.", icon: "Medal", earned: (s) => s.habitChecks >= 66, hint: "Check in 66 habit days" },
  { id: "dump-first", name: "Brain Dumper", description: "Completed a timed free recall.", icon: "PenLine", earned: (s) => s.dumps >= 1, hint: "Finish a book and brain dump" },
  { id: "rewrite-first", name: "Schema Bender", description: "Ran a memory reconsolidation rewrite.", icon: "Sparkles", earned: (s) => s.rewrites >= 1, hint: "Complete a schema rewrite" },
];

/** Consecutive days (ending today or yesterday) with at least one sprint. */
export function computeStreak(sessionDates: string[]): number {
  const days = new Set(sessionDates.map((d) => d.slice(0, 10)));
  const DAY_MS = 86_400_000;
  let cursor = Date.now();
  if (!days.has(new Date(cursor).toISOString().slice(0, 10))) cursor -= DAY_MS;
  let streak = 0;
  while (days.has(new Date(cursor).toISOString().slice(0, 10))) {
    streak++;
    cursor -= DAY_MS;
  }
  return streak;
}
