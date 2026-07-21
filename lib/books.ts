"use client";

// ============================================================================
// Client-side book pipeline: Storage upload -> books row -> extraction API.
// ============================================================================

import { getSupabase } from "./supabase";
import type { Book } from "./types";

const STORAGE_BUCKET = "books";
export const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50 MB

export type UploadPhase = "uploading" | "extracting";

export class BookUploadError extends Error {}

/**
 * Full ingestion pipeline for one PDF:
 *  1. upload the file to Storage under <user_id>/<uuid>.pdf
 *  2. insert the `books` row (status: uploaded)
 *  3. call POST /api/books/extract to pull the raw text server-side
 * Returns the ready book with `extracted_text` populated.
 */
export async function uploadAndExtractBook(
  file: File,
  onPhase?: (phase: UploadPhase) => void
): Promise<Book> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new BookUploadError("Only PDF files are accepted.");
  }
  if (file.size > MAX_PDF_BYTES) {
    throw new BookUploadError("PDF exceeds the 50 MB limit.");
  }

  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new BookUploadError("Sign in before uploading a book.");
  }

  onPhase?.("uploading");
  const storagePath = `${session.user.id}/${crypto.randomUUID()}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, { contentType: "application/pdf" });
  if (uploadError) {
    throw new BookUploadError(`Upload failed: ${uploadError.message}`);
  }

  const title = file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
  const { data: book, error: insertError } = await supabase
    .from("books")
    .insert({
      user_id: session.user.id,
      title: title || "Untitled book",
      status: "uploaded",
      storage_path: storagePath,
    })
    .select("*")
    .single<Book>();
  if (insertError || !book) {
    // Roll back the orphaned file so Storage doesn't accumulate junk.
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    throw new BookUploadError(`Could not register book: ${insertError?.message}`);
  }

  onPhase?.("extracting");
  const res = await fetch("/api/books/extract", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ bookId: book.id }),
  });

  const payload = (await res.json()) as { book?: Book; error?: string };
  if (!res.ok || !payload.book) {
    throw new BookUploadError(payload.error ?? "Text extraction failed.");
  }
  return payload.book;
}
