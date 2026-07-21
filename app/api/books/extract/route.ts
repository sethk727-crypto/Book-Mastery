// ============================================================================
// POST /api/books/extract — download an uploaded PDF from Supabase Storage,
// extract its raw text with pdf-parse, and persist it to books.extracted_text
// so the RSVP engine can consume it.
//
// Body: { "bookId": "<uuid>" }
// Auth: Bearer <supabase access token> — the caller must own the book row.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { getSupabase } from "@/lib/supabase";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { Book } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60; // large books take a while to parse

const STORAGE_BUCKET = "books";

/** Collapse pdf-parse output into clean paragraphs for the RSVP tokenizer. */
function normalizeExtractedText(raw: string): string {
  return (
    raw
      // Windows/Mac line endings -> \n
      .replace(/\r\n?/g, "\n")
      // De-hyphenate words broken across line ends: "consoli-\ndation"
      .replace(/([A-Za-z])-\n([a-z])/g, "$1$2")
      // Single newlines inside a paragraph are soft wraps -> spaces
      .replace(/([^\n])\n(?!\n)/g, "$1 ")
      // Collapse runs of blank lines to exactly one paragraph break
      .replace(/\n{2,}/g, "\n\n")
      // Strip stray form feeds / repeated spaces
      .replace(/\f/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
  );
}

function countWords(text: string): number {
  return text.length === 0 ? 0 : text.split(/\s+/).length;
}

export async function POST(req: NextRequest) {
  // ---- 1. Authenticate the caller from their Supabase JWT ------------------
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
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

  // ---- 2. Load the book row and verify ownership ---------------------------
  let bookId: string;
  try {
    const body = (await req.json()) as { bookId?: string };
    if (!body.bookId) throw new Error("bookId required");
    bookId = body.bookId;
  } catch {
    return NextResponse.json({ error: "Body must be { bookId }" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: book, error: bookError } = await admin
    .from("books")
    .select("*")
    .eq("id", bookId)
    .single<Book>();

  if (bookError || !book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
  if (book.user_id !== user.id) {
    return NextResponse.json({ error: "Not your book" }, { status: 403 });
  }
  if (!book.storage_path) {
    return NextResponse.json({ error: "Book has no uploaded file" }, { status: 409 });
  }

  await admin.from("books").update({ status: "processing" }).eq("id", bookId);

  try {
    // ---- 3. Download the PDF from Storage ----------------------------------
    const { data: blob, error: downloadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .download(book.storage_path);
    if (downloadError || !blob) {
      throw new Error(`Storage download failed: ${downloadError?.message}`);
    }

    // ---- 4. Extract and normalize the text ---------------------------------
    const buffer = Buffer.from(await blob.arrayBuffer());
    const parsed = await pdfParse(buffer);
    const text = normalizeExtractedText(parsed.text ?? "");

    if (text.length === 0) {
      // Likely a scanned/image-only PDF — surface a precise error.
      await admin.from("books").update({ status: "uploaded" }).eq("id", bookId);
      return NextResponse.json(
        {
          error:
            "No extractable text found. This PDF appears to be scanned images; run OCR before uploading.",
        },
        { status: 422 }
      );
    }

    // ---- 5. Persist and mark ready -----------------------------------------
    const { data: updated, error: updateError } = await admin
      .from("books")
      .update({
        extracted_text: text,
        word_count: countWords(text),
        status: "ready",
      })
      .eq("id", bookId)
      .select("*")
      .single<Book>();

    if (updateError || !updated) {
      throw new Error(`Failed to save extraction: ${updateError?.message}`);
    }

    return NextResponse.json({
      book: updated,
      pages: parsed.numpages,
      words: updated.word_count,
    });
  } catch (err) {
    await admin.from("books").update({ status: "uploaded" }).eq("id", bookId);
    const message = err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
