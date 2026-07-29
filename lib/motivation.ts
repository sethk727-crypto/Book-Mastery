// ============================================================================
// Motivation Mode content — an NLP-structured monologue (pacing → leading →
// embedded commands → visualization → identity → future-pace) personalized
// with the reader's name, plus the rotating quote wall drawn from the
// user's own journal.
// ============================================================================

/**
 * The RSVP script. Written to the NLP playbook:
 *  - opens by PACING the reader's verifiable present (sitting, watching words)
 *  - uses visual/auditory/kinesthetic predicates in rotation
 *  - embeds commands inside soft frames ("you might notice yourself…")
 *  - runs a submodality-rich visualization (the car, the house, the water)
 *  - collapses into identity affirmations in the reader's own voice
 *  - future-paces the next action so the state fires after the session ends
 * Punctuation is deliberate — commas and periods drive the RSVP pauses.
 */
export function buildMotivationScript(name: string): string {
  const n = name.trim() || "Champion";
  return [
    // ---- Pacing: match what is verifiably true right now
    `${n}. You are here. You are sitting, watching these words arrive, one by one. You can feel your breathing, slowing to the rhythm of this text. And as each word lands, you may notice your focus getting sharper, and sharper.`,

    // ---- Leading + embedded commands
    `Good. Because while you watch this, your deeper mind is listening. And it can begin, right now, to build the picture. Let it.`,

    // ---- Visualization: the car (visual → auditory → kinesthetic)
    `See it, ${n}. The Porsche 911, in your color, parked in your driveway. Look at the light rolling off the curve of the fender. Now hear it. The engine turning over, that low growl you can feel in your chest. Reach out. Feel the wheel in your hands. Cold. Solid. Yours.`,

    // ---- The house
    `Now widen the frame. The house in Miami. Walk through the front door you chose. Feel the warm air moving off the water. Hear your own footsteps in a home that your work paid for. This is not a dream, ${n}. This is a memory from your future.`,

    // ---- The confrontation
    `So answer the only question that matters. How bad do you want it, ${n}? How bad? Bad enough to work when nobody claps? Bad enough to move with speed, today, while others wait for permission?`,

    // ---- Identity (the reader's own doctrine, first person)
    `Then say it with me. I am not where I came from. I am where I am going. My mind serves my mission, not my mood. My subconscious obeys me. I act, even when I do not feel like it. I was not lazy. I was surviving. Now, I am building.`,

    `I am the architect. Today I operate as the causer, not the effect. I refuse to be swung by fear, by debt, by lack. I make my thoughts so consistent, that reality has no choice but to catch up.`,

    // ---- Amplify (spin the feeling)
    `Notice where that feeling starts in your body, ${n}. Now spin it. Faster. Brighter. Bigger. Let it fill your chest, your hands, your jaw. That is the fuel. It was always yours.`,

    // ---- Future pace: bridge the state to the next real action
    `In a moment, this ends, and the work begins. The first thing you will see is your next task. And when you see it, this exact feeling fires again, and you move. Immediately. With speed. Because discipline is doing it no matter how you feel, and you, ${n}, are the strong one.`,

    // ---- Close
    `Act as if. Train as the strongest. Study as the smartest. Speak with total conviction. And slowly, then suddenly, you become it. Now go, ${n}. The show must go on. F. T. E.`,
  ].join("\n\n");
}

/** Rotating quote wall — the reader's own journal lines plus their citations. */
export const MOTIVATION_QUOTES: string[] = [
  "I am already becoming the man I admire. My mind serves my mission, not my mood.",
  "My subconscious obeys me. I act, even when I don't feel like it.",
  "I am not lazy. I was just surviving. Now I am building. My edge is focus.",
  "Make your thoughts so consistent that reality has no choice but to catch up.",
  "I am not where I came from — I am where I'm going.",
  "Motivation is a feeling. Discipline is doing the task no matter how you feel.",
  "Speed, speed, speed. Get used to moving fast — you won't ever slow down.",
  "ACT AS IF — and slowly you will become it.",
  "The strong do as they will; the weak do as they must.",
  "I execute daily because my why is greater than my comfort.",
  "Your current reality is a mirror of your inner mind. Strive for excellence.",
  "Overcome laziness and you'll pass the majority of people.",
  "Become a wall built on the foundations you follow.",
  "The show must go on. Become resilient to every problem you face.",
  "Impossible is just I'm possible.",
  "The darker the night, the brighter the stars.",
  "Little strokes fell great oaks.",
  "A coward dies a thousand times before his death; the valiant taste of death but once.",
  "The greatest glory in living lies not in never falling, but in rising every time we fall.",
  "Use your broken past as an obligation to rise above.",
  "My discipline is my legacy.",
];
