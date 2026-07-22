// ============================================================================
// POST /api/quiz — generate a post-sprint comprehension test from the exact
// word range the reader just consumed.
//
// Provider selection: uses OPENAI_API_KEY if set, otherwise
// ANTHROPIC_API_KEY. Returns 503 when neither is configured so the UI can
// degrade gracefully.
//
// Body: { "bookId": "<uuid>", "startWord": number, "endWord": number }
// Auth: Bearer <supabase access token> — caller must own the book.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { Book, QuizQuestion } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_EXCERPT_WORDS = 6000;
const QUESTION_COUNT = 5;

const QUIZ_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          correct_index: { type: "integer", enum: [0, 1, 2, 3] },
          explanation: { type: "string" },
        },
        required: ["question", "options", "correct_index", "explanation"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
} as const;

/**
 * Env values pasted into hosting dashboards often pick up stray newlines or
 * spaces; a newline in a header value throws "invalid header value". API keys
 * and model names never contain whitespace, so strip it all.
 */
function cleanEnv(value: string | undefined): string | undefined {
  const cleaned = value?.replace(/\s+/g, "");
  return cleaned ? cleaned : undefined;
}

const SYSTEM_PROMPT =
  "You write comprehension tests for a speed-reading app. Questions must be answerable ONLY from the provided excerpt, test genuine understanding (main claims, causal reasoning, key details) rather than trivia, and have exactly one clearly correct option among four plausible ones.";

function userPrompt(title: string, excerpt: string): string {
  return `The reader just speed-read this excerpt from "${title}". Write exactly ${QUESTION_COUNT} multiple-choice questions, each with exactly 4 options.\n\n<excerpt>\n${excerpt}\n</excerpt>`;
}

// ---- Provider: OpenAI (used when OPENAI_API_KEY is set) --------------------

async function generateWithOpenAI(title: string, excerpt: string): Promise<string> {
  const model = cleanEnv(process.env.OPENAI_QUIZ_MODEL) ?? "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cleanEnv(process.env.OPENAI_API_KEY)}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt(title, excerpt) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "quiz", strict: true, schema: QUIZ_SCHEMA },
      },
    }),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(
      `OpenAI request failed (${res.status}): ${detail?.error?.message ?? "unknown error"}`
    );
  }
  const payload = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned no content");
  return content;
}

// ---- Provider: Claude (fallback when only ANTHROPIC_API_KEY is set) --------

async function generateWithClaude(title: string, excerpt: string): Promise<string> {
  const anthropic = new Anthropic({ apiKey: cleanEnv(process.env.ANTHROPIC_API_KEY) });
  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: QUIZ_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt(title, excerpt) }],
  });
  if (response.stop_reason === "refusal") {
    throw new Error("Quiz generation was declined for this content.");
  }
  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );
  if (!textBlock) throw new Error("No text content in model response");
  return textBlock.text;
}

export async function POST(req: NextRequest) {
  const provider = cleanEnv(process.env.OPENAI_API_KEY)
    ? "openai"
    : cleanEnv(process.env.ANTHROPIC_API_KEY)
      ? "claude"
      : null;

  if (!provider) {
    return NextResponse.json(
      {
        error:
          "Comprehension quizzes are not configured. Set OPENAI_API_KEY (or ANTHROPIC_API_KEY) in your deployment environment.",
      },
      { status: 503 }
    );
  }

  // ---- Authenticate --------------------------------------------------------
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }
  const {
    data: { user },
    error: authError,
  } = await getSupabase().auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  // ---- Load the book and slice the excerpt ---------------------------------
  let body: { bookId?: string; startWord?: number; endWord?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { bookId, startWord = 0, endWord } = body;
  if (!bookId || typeof endWord !== "number" || endWord <= startWord) {
    return NextResponse.json(
      { error: "Body must be { bookId, startWord, endWord } with endWord > startWord" },
      { status: 400 }
    );
  }

  const { data: book } = await getSupabaseAdmin()
    .from("books")
    .select("id, user_id, title, extracted_text")
    .eq("id", bookId)
    .single<Pick<Book, "id" | "user_id" | "title" | "extracted_text">>();

  if (!book || book.user_id !== user.id) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
  if (!book.extracted_text) {
    return NextResponse.json({ error: "Book has no extracted text" }, { status: 409 });
  }

  const words = book.extracted_text.split(/\s+/);
  const sliceEnd = Math.min(endWord, words.length);
  const sliceStart = Math.max(0, Math.max(startWord, sliceEnd - MAX_EXCERPT_WORDS));
  const excerpt = words.slice(sliceStart, sliceEnd).join(" ");

  if (excerpt.split(/\s+/).length < 50) {
    return NextResponse.json(
      { error: "Not enough text read yet to build a quiz — sprint a bit further first." },
      { status: 422 }
    );
  }

  // ---- Generate the quiz ---------------------------------------------------
  try {
    const raw =
      provider === "openai"
        ? await generateWithOpenAI(book.title, excerpt)
        : await generateWithClaude(book.title, excerpt);

    const parsed = JSON.parse(raw) as { questions: QuizQuestion[] };
    const questions = parsed.questions
      .filter((q) => q.options.length === 4)
      .slice(0, QUESTION_COUNT);

    if (questions.length === 0) {
      throw new Error("Model returned no usable questions");
    }

    return NextResponse.json({ questions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Quiz generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
